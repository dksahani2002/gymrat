import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  addDaysKey,
  computeStreak,
  dateKeyInTimeZone,
  parseDateKey,
  SECONDARY_MUSCLE_FACTOR,
  setVolumeKg,
  weekStartKey,
} from '../../domain/analytics/analytics.helpers';
import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepository,
  WorkoutAnalyticsSlice,
} from '../../domain/analytics/repositories/analytics.repository';
import { estimated1RmKg } from '../../shared/utils/epley.utils';
import { RedisService } from '../../infrastructure/cache/redis.module';
import { BusinessError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';

export type VolumePeriod = 'day' | 'week' | 'month' | 'year';

export type ChartType =
  | 'volume_over_time'
  | 'muscle_volume_breakdown'
  | 'muscle_volume_over_time'
  | 'frequency_heatmap'
  | 'e1rm_over_time'
  | 'body_weight_over_time'
  | 'duration_over_time';

export interface ChartPoint {
  x: string;
  y: number;
  label?: string;
  meta?: Record<string, unknown>;
}

/**
 * Analytics recompute + read APIs (sync event-driven; BullMQ later).
 */
@Injectable()
export class AnalyticsApplicationService {
  private readonly logger = new Logger(AnalyticsApplicationService.name);
  private readonly cacheTtlSec = 900;

  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analytics: AnalyticsRepository,
    private readonly redis: RedisService,
  ) {}

  async recomputeForDate(input: {
    userId: string;
    anchorAt: Date;
  }): Promise<void> {
    const timeZone = await this.analytics.getUserTimezone(input.userId);
    const dateKey = dateKeyInTimeZone(input.anchorAt, timeZone);
    await this.recomputeLocalDate(input.userId, dateKey, timeZone);
    await this.invalidateCache(input.userId);
  }

  /**
   * Idempotent backfill for a local-date range (admin / runbook).
   */
  async recomputeRange(input: {
    userId: string;
    from: string;
    to: string;
  }): Promise<{ days: number }> {
    this.assertRange(input.from, input.to);
    const timeZone = await this.analytics.getUserTimezone(input.userId);
    let days = 0;
    for (
      let dateKey = input.from;
      dateKey <= input.to;
      dateKey = addDaysKey(dateKey, 1)
    ) {
      await this.recomputeLocalDate(input.userId, dateKey, timeZone);
      days += 1;
    }
    await this.invalidateCache(input.userId);
    this.logger.log(
      `Recomputed analytics range user=${input.userId} from=${input.from} to=${input.to} days=${days}`,
    );
    return { days };
  }

  async overview(userId: string) {
    const cacheKey = `analytics:${userId}:overview`;
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const timeZone = await this.analytics.getUserTimezone(userId);
    const today = dateKeyInTimeZone(new Date(), timeZone);
    const trained = await this.analytics.listTrainedDateKeys(userId, timeZone);
    const streak = computeStreak(trained, today);

    const weekStart = weekStartKey(today);
    const weekEnd = addDaysKey(weekStart, 6);
    const from28 = addDaysKey(today, -27);

    const [weekDays, last28, totalWorkouts] = await Promise.all([
      this.analytics.listDaily(userId, weekStart, weekEnd),
      this.analytics.listDaily(userId, from28, today),
      this.analytics.countCompletedWorkouts(userId),
    ]);

    const sum = (rows: { totalVolumeKg: number; workoutCount: number }[]) =>
      rows.reduce(
        (acc, row) => {
          acc.volume += row.totalVolumeKg;
          acc.workouts += row.workoutCount;
          return acc;
        },
        { volume: 0, workouts: 0 },
      );

    const week = sum(weekDays);
    const month = sum(last28);
    const trainedDays28 = last28.filter((d) => d.workoutCount > 0).length;
    const consistency28d = Math.round((trainedDays28 / 28) * 1000) / 1000;

    const payload = {
      streak,
      timezone: timeZone,
      workoutsThisWeek: week.workouts,
      volumeThisWeekKg: Math.round(week.volume * 100) / 100,
      volumeLast28dKg: Math.round(month.volume * 100) / 100,
      trainedDaysLast28: trainedDays28,
      consistency28d,
      totalCompletedWorkouts: totalWorkouts,
    };

    await this.redis.raw.set(
      cacheKey,
      JSON.stringify(payload),
      'EX',
      this.cacheTtlSec,
    );
    return payload;
  }

  async volumeSeries(input: {
    userId: string;
    from: string;
    to: string;
    period?: VolumePeriod;
  }) {
    this.assertRange(input.from, input.to);
    const period = input.period ?? 'day';

    if (period === 'day') {
      const rows = await this.analytics.listDaily(
        input.userId,
        input.from,
        input.to,
      );
      return {
        period,
        unit: 'kg',
        points: rows.map((row) => ({
          x: row.date,
          y: row.totalVolumeKg,
          label: row.date,
          meta: {
            workoutCount: row.workoutCount,
            setCount: row.setCount,
          },
        })),
      };
    }

    if (period === 'week') {
      const fromWeek = weekStartKey(input.from);
      const toWeek = weekStartKey(input.to);
      const rows = await this.analytics.listWeekly(
        input.userId,
        fromWeek,
        toWeek,
      );
      return {
        period,
        unit: 'kg',
        points: rows.map((row) => ({
          x: row.weekStart,
          y: row.totalVolumeKg,
          label: row.weekStart,
          meta: {
            workoutCount: row.workoutCount,
            trainingDays: row.trainingDays,
          },
        })),
      };
    }

    // month / year: roll up daily snapshots
    const rows = await this.analytics.listDaily(
      input.userId,
      input.from,
      input.to,
    );
    const buckets = new Map<string, number>();
    for (const row of rows) {
      const key =
        period === 'month' ? row.date.slice(0, 7) : row.date.slice(0, 4);
      buckets.set(key, (buckets.get(key) ?? 0) + row.totalVolumeKg);
    }
    return {
      period,
      unit: 'kg',
      points: [...buckets.entries()].map(([x, y]) => ({
        x,
        y: Math.round(y * 100) / 100,
        label: x,
      })),
    };
  }

  async exerciseVolume(input: {
    userId: string;
    exerciseId: string;
    from: string;
    to: string;
  }) {
    this.assertRange(input.from, input.to);
    const timeZone = await this.analytics.getUserTimezone(input.userId);
    const { fromUtc, toUtc } = this.utcWindowForLocalRange(
      input.from,
      input.to,
      timeZone,
    );
    const points = await this.analytics.exerciseVolumeSeries(
      input.userId,
      input.exerciseId,
      fromUtc,
      toUtc,
      timeZone,
    );
    return {
      exerciseId: input.exerciseId,
      unit: 'kg',
      points: points.map((p) => ({
        x: p.date,
        y: p.volumeKg,
        label: p.date,
        meta: {
          setCount: p.setCount,
          bestWeightKg: p.bestWeightKg,
          bestEstimated1rmKg: p.bestEstimated1rmKg,
        },
      })),
    };
  }

  async muscleVolume(input: {
    userId: string;
    from: string;
    to: string;
    series?: boolean;
  }) {
    this.assertRange(input.from, input.to);
    const rows = await this.analytics.listMuscleVolume(
      input.userId,
      input.from,
      input.to,
    );

    if (input.series) {
      return {
        unit: 'kg',
        points: rows.map((row) => ({
          x: row.date,
          y: row.volumeKg,
          label: row.muscleGroupName,
          meta: {
            muscleGroupId: row.muscleGroupId,
            slug: row.muscleGroupSlug,
            setCount: row.setCount,
          },
        })),
      };
    }

    const byMuscle = new Map<
      string,
      { name: string; slug: string; volumeKg: number; setCount: number }
    >();
    for (const row of rows) {
      const existing = byMuscle.get(row.muscleGroupId) ?? {
        name: row.muscleGroupName,
        slug: row.muscleGroupSlug,
        volumeKg: 0,
        setCount: 0,
      };
      existing.volumeKg += row.volumeKg;
      existing.setCount += row.setCount;
      byMuscle.set(row.muscleGroupId, existing);
    }

    return {
      unit: 'kg',
      items: [...byMuscle.entries()]
        .map(([muscleGroupId, value]) => ({
          muscleGroupId,
          name: value.name,
          slug: value.slug,
          volumeKg: Math.round(value.volumeKg * 100) / 100,
          setCount: value.setCount,
        }))
        .sort((a, b) => b.volumeKg - a.volumeKg),
    };
  }

  async estimated1rm(input: {
    userId: string;
    exerciseId: string;
    from: string;
    to: string;
  }) {
    const series = await this.exerciseVolume(input);
    return {
      exerciseId: input.exerciseId,
      unit: 'kg',
      points: series.points
        .filter((p) => (p.meta?.bestEstimated1rmKg as number | null) != null)
        .map((p) => ({
          x: p.x,
          y: p.meta!.bestEstimated1rmKg as number,
          label: p.label,
        })),
    };
  }

  async frequency(input: { userId: string; from: string; to: string }) {
    this.assertRange(input.from, input.to);
    const rows = await this.analytics.listDaily(
      input.userId,
      input.from,
      input.to,
    );
    const totalWorkouts = rows.reduce((s, r) => s + r.workoutCount, 0);
    const trainedDays = rows.filter((r) => r.workoutCount > 0).length;
    const daySpan =
      Math.round(
        (parseDateKey(input.to).getTime() -
          parseDateKey(input.from).getTime()) /
          86_400_000,
      ) + 1;
    const weeks = Math.max(daySpan / 7, 1 / 7);
    return {
      from: input.from,
      to: input.to,
      totalWorkouts,
      trainedDays,
      workoutsPerWeek: Math.round((totalWorkouts / weeks) * 100) / 100,
      points: rows.map((row) => ({
        x: row.date,
        y: row.workoutCount,
        label: row.date,
      })),
    };
  }

  async consistency(input: {
    userId: string;
    from?: string;
    to?: string;
    targetDays?: number;
  }) {
    const timeZone = await this.analytics.getUserTimezone(input.userId);
    const to = input.to ?? dateKeyInTimeZone(new Date(), timeZone);
    const targetDays = Math.min(Math.max(input.targetDays ?? 28, 1), 365);
    const from = input.from ?? addDaysKey(to, -(targetDays - 1));
    this.assertRange(from, to);

    const rows = await this.analytics.listDaily(input.userId, from, to);
    const trainedDays = rows.filter((r) => r.workoutCount > 0).length;
    const daySpan =
      Math.round(
        (parseDateKey(to).getTime() - parseDateKey(from).getTime()) /
          86_400_000,
      ) + 1;
    const plannedOrTarget = Math.min(targetDays, daySpan);
    const score =
      plannedOrTarget === 0
        ? 0
        : Math.round((trainedDays / plannedOrTarget) * 1000) / 1000;

    return {
      from,
      to,
      trainedDays,
      targetDays: plannedOrTarget,
      consistency: score,
    };
  }

  async duration(input: { userId: string; from: string; to: string }) {
    this.assertRange(input.from, input.to);
    const rows = await this.analytics.listDaily(
      input.userId,
      input.from,
      input.to,
    );
    return {
      unit: 'sec',
      points: rows.map((row) => ({
        x: row.date,
        y: row.totalDurationSec,
        label: row.date,
        meta: { workoutCount: row.workoutCount },
      })),
    };
  }

  async chart(input: {
    userId: string;
    chartType: ChartType;
    from: string;
    to: string;
    interval?: VolumePeriod;
    exerciseId?: string;
  }): Promise<{ chartType: ChartType; unit: string; points: ChartPoint[] }> {
    this.assertRange(input.from, input.to);

    switch (input.chartType) {
      case 'volume_over_time': {
        const series = await this.volumeSeries({
          userId: input.userId,
          from: input.from,
          to: input.to,
          period: input.interval ?? 'day',
        });
        return {
          chartType: input.chartType,
          unit: series.unit,
          points: series.points,
        };
      }
      case 'muscle_volume_breakdown': {
        const data = await this.muscleVolume({
          userId: input.userId,
          from: input.from,
          to: input.to,
        });
        const items = (
          data as {
            items: Array<{ slug: string; name: string; volumeKg: number }>;
          }
        ).items;
        return {
          chartType: input.chartType,
          unit: 'kg',
          points: items.map((item) => ({
            x: item.slug,
            y: item.volumeKg,
            label: item.name,
          })),
        };
      }
      case 'muscle_volume_over_time': {
        const data = await this.muscleVolume({
          userId: input.userId,
          from: input.from,
          to: input.to,
          series: true,
        });
        return {
          chartType: input.chartType,
          unit: 'kg',
          points: (data as { points: ChartPoint[] }).points,
        };
      }
      case 'frequency_heatmap': {
        const freq = await this.frequency(input);
        return {
          chartType: input.chartType,
          unit: 'workouts',
          points: freq.points,
        };
      }
      case 'e1rm_over_time': {
        if (!input.exerciseId) {
          throw new BusinessError(
            'exerciseId is required for e1rm_over_time',
            ErrorCodes.VALIDATION_ERROR,
            400,
          );
        }
        const series = await this.estimated1rm({
          userId: input.userId,
          exerciseId: input.exerciseId,
          from: input.from,
          to: input.to,
        });
        return {
          chartType: input.chartType,
          unit: series.unit,
          points: series.points,
        };
      }
      case 'duration_over_time': {
        const series = await this.duration(input);
        return {
          chartType: input.chartType,
          unit: series.unit,
          points: series.points,
        };
      }
      case 'body_weight_over_time': {
        const fromUtc = parseDateKey(input.from);
        const toUtc = new Date(
          parseDateKey(input.to).getTime() + 86_400_000 - 1,
        );
        const rows = await this.analytics.listBodyWeightKg(
          input.userId,
          fromUtc,
          toUtc,
        );
        return {
          chartType: input.chartType,
          unit: 'kg',
          points: rows.map((row) => ({
            x: row.recordedAt.toISOString(),
            y: row.weightKg,
            label: row.recordedAt.toISOString().slice(0, 10),
          })),
        };
      }
      default:
        throw new BusinessError(
          `Unsupported chart type: ${input.chartType as string}`,
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
    }
  }

  private async recomputeLocalDate(
    userId: string,
    dateKey: string,
    timeZone: string,
  ): Promise<void> {
    const { fromUtc, toUtc } = this.utcWindowForLocalRange(
      addDaysKey(dateKey, -1),
      addDaysKey(dateKey, 1),
      timeZone,
    );
    const workouts = (
      await this.analytics.findCompletedWorkoutsAround(userId, fromUtc, toUtc)
    ).filter((w) => dateKeyInTimeZone(w.completedAt, timeZone) === dateKey);

    let totalVolumeKg = 0;
    let totalDurationSec = 0;
    let setCount = 0;
    const muscleAgg = new Map<string, { volumeKg: number; setCount: number }>();
    const exerciseIds = new Set<string>();

    for (const workout of workouts) {
      totalDurationSec += workout.durationSec ?? 0;
      for (const exercise of workout.exercises) {
        exerciseIds.add(exercise.exerciseId);
        for (const set of exercise.sets) {
          if (set.isWarmup) continue;
          setCount += 1;
          totalVolumeKg += setVolumeKg(set.weightKg, set.reps);
        }
      }
    }

    totalVolumeKg = Math.round(totalVolumeKg * 100) / 100;

    await this.analytics.upsertDaily({
      userId,
      date: dateKey,
      workoutCount: workouts.length,
      totalVolumeKg,
      totalDurationSec,
      setCount,
    });

    const muscles = await this.analytics.findExerciseMuscles([...exerciseIds]);
    const musclesByExercise = new Map<string, typeof muscles>();
    for (const link of muscles) {
      const list = musclesByExercise.get(link.exerciseId) ?? [];
      list.push(link);
      musclesByExercise.set(link.exerciseId, list);
    }

    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        let exerciseVolume = 0;
        let workingSets = 0;
        for (const set of exercise.sets) {
          if (set.isWarmup) continue;
          workingSets += 1;
          exerciseVolume += setVolumeKg(set.weightKg, set.reps);
        }
        const links = musclesByExercise.get(exercise.exerciseId) ?? [];
        for (const link of links) {
          const factor = link.role === 'PRIMARY' ? 1 : SECONDARY_MUSCLE_FACTOR;
          const current = muscleAgg.get(link.muscleGroupId) ?? {
            volumeKg: 0,
            setCount: 0,
          };
          current.volumeKg += exerciseVolume * factor;
          current.setCount += workingSets;
          muscleAgg.set(link.muscleGroupId, current);
        }
      }
    }

    await this.analytics.replaceMuscleVolumeForDay(
      userId,
      dateKey,
      [...muscleAgg.entries()].map(([muscleGroupId, value]) => ({
        userId,
        muscleGroupId,
        date: dateKey,
        volumeKg: Math.round(value.volumeKg * 100) / 100,
        setCount: value.setCount,
      })),
    );

    await this.recomputeWeek(userId, dateKey);
    await this.recomputeExerciseStats(userId, workouts);

    this.logger.log(
      `Recomputed analytics for user=${userId} date=${dateKey} workouts=${workouts.length}`,
    );
  }

  private async recomputeWeek(userId: string, dateKey: string): Promise<void> {
    const start = weekStartKey(dateKey);
    const end = addDaysKey(start, 6);
    const days = await this.analytics.listDaily(userId, start, end);
    const dayMap = new Map(days.map((d) => [d.date, d]));

    let workoutCount = 0;
    let totalVolumeKg = 0;
    let totalDurationSec = 0;
    let trainingDays = 0;
    for (let i = 0; i < 7; i += 1) {
      const key = addDaysKey(start, i);
      const day = dayMap.get(key);
      if (!day) continue;
      workoutCount += day.workoutCount;
      totalVolumeKg += day.totalVolumeKg;
      totalDurationSec += day.totalDurationSec;
      if (day.workoutCount > 0) trainingDays += 1;
    }

    await this.analytics.upsertWeekly({
      userId,
      weekStart: start,
      workoutCount,
      totalVolumeKg: Math.round(totalVolumeKg * 100) / 100,
      totalDurationSec,
      trainingDays,
    });
  }

  private async recomputeExerciseStats(
    userId: string,
    dayWorkouts: WorkoutAnalyticsSlice[],
  ): Promise<void> {
    const byExercise = new Map<
      string,
      {
        lastWeightKg: number | null;
        lastReps: number | null;
        lastVolumeKg: number;
        sessionBestWeight: number | null;
        sessionBestE1rm: number | null;
        lastPerformedAt: Date;
      }
    >();

    const ordered = [...dayWorkouts].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
    );

    for (const workout of ordered) {
      for (const exercise of workout.exercises) {
        let volume = 0;
        let lastWeight: number | null = null;
        let lastReps: number | null = null;
        let bestWeight: number | null = null;
        let bestE1rm: number | null = null;
        let hasWorking = false;

        for (const set of exercise.sets) {
          if (set.isWarmup) continue;
          hasWorking = true;
          volume += setVolumeKg(set.weightKg, set.reps);
          if (set.weightKg !== null) {
            lastWeight = set.weightKg;
            bestWeight =
              bestWeight === null
                ? set.weightKg
                : Math.max(bestWeight, set.weightKg);
          }
          if (set.reps !== null) lastReps = set.reps;
          if (set.weightKg !== null && set.reps !== null) {
            const e1rm = estimated1RmKg(set.weightKg, set.reps);
            if (e1rm !== null) {
              bestE1rm = bestE1rm === null ? e1rm : Math.max(bestE1rm, e1rm);
            }
          }
        }
        if (!hasWorking) continue;

        byExercise.set(exercise.exerciseId, {
          lastWeightKg: lastWeight,
          lastReps,
          lastVolumeKg: Math.round(volume * 100) / 100,
          sessionBestWeight: bestWeight,
          sessionBestE1rm: bestE1rm,
          lastPerformedAt: workout.completedAt,
        });
      }
    }

    for (const [exerciseId, session] of byExercise) {
      const prior = await this.analytics.getExerciseStat(userId, exerciseId);
      const totalSessions = await this.analytics.countSessionsForExercise(
        userId,
        exerciseId,
      );
      await this.analytics.upsertExerciseStat({
        userId,
        exerciseId,
        lastWeightKg: session.lastWeightKg,
        lastReps: session.lastReps,
        lastVolumeKg: session.lastVolumeKg,
        bestWeightKg: this.maxNullable(
          prior?.bestWeightKg ?? null,
          session.sessionBestWeight,
        ),
        bestEstimated1rmKg: this.maxNullable(
          prior?.bestEstimated1rmKg ?? null,
          session.sessionBestE1rm,
        ),
        totalSessions,
        lastPerformedAt: session.lastPerformedAt,
      });
    }
  }

  private maxNullable(a: number | null, b: number | null): number | null {
    if (a === null) return b;
    if (b === null) return a;
    return Math.max(a, b);
  }

  private assertRange(from: string, to: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BusinessError(
        'from/to must be YYYY-MM-DD',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (from > to) {
      throw new BusinessError(
        'from must be <= to',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    const span =
      (parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000;
    if (span > 366) {
      throw new BusinessError(
        'Date range cannot exceed 366 days',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private utcWindowForLocalRange(
    from: string,
    to: string,
    timeZone: string,
  ): { fromUtc: Date; toUtc: Date } {
    void timeZone;
    // Pad ±1 day so timezone shifts still include local dates.
    const fromUtc = parseDateKey(addDaysKey(from, -1));
    const toUtc = parseDateKey(addDaysKey(to, 2));
    return { fromUtc, toUtc };
  }

  private async invalidateCache(userId: string): Promise<void> {
    const pattern = `analytics:${userId}:*`;
    const keys = await this.redis.raw.keys(pattern);
    if (keys.length > 0) {
      await this.redis.raw.del(...keys);
    }
  }
}
