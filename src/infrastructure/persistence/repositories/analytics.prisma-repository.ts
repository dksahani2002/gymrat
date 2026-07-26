import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AnalyticsRepository,
  DailySnapshotRecord,
  ExerciseMuscleLink,
  ExerciseSeriesPoint,
  ExerciseStatRecord,
  MuscleVolumeRecord,
  UpsertDailyInput,
  UpsertExerciseStatInput,
  UpsertMuscleVolumeInput,
  UpsertWeeklyInput,
  WeeklySnapshotRecord,
  WorkoutAnalyticsSlice,
} from '../../../domain/analytics/repositories/analytics.repository';
import {
  dateKeyInTimeZone,
  setVolumeKg,
} from '../../../domain/analytics/analytics.helpers';
import { estimated1RmKg } from '../../../shared/utils/epley.utils';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsPrismaRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserTimezone(userId: string): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone ?? 'UTC';
  }

  async findCompletedWorkoutsAround(
    userId: string,
    fromUtc: Date,
    toUtc: Date,
  ): Promise<WorkoutAnalyticsSlice[]> {
    const rows = await this.prisma.workout.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'COMPLETED',
        completedAt: { gte: fromUtc, lt: toUtc },
      },
      include: {
        exercises: {
          include: {
            sets: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      completedAt: row.completedAt!,
      durationSec: row.durationSec,
      exercises: row.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: exercise.sets.map((set) => ({
          reps: set.reps,
          weightKg: set.weightKg ? Number(set.weightKg) : null,
          isWarmup: set.isWarmup,
        })),
      })),
    }));
  }

  async findExerciseMuscles(exerciseIds: string[]): Promise<ExerciseMuscleLink[]> {
    if (exerciseIds.length === 0) return [];
    const rows = await this.prisma.exerciseMuscle.findMany({
      where: { exerciseId: { in: exerciseIds } },
    });
    return rows.map((row) => ({
      exerciseId: row.exerciseId,
      muscleGroupId: row.muscleGroupId,
      role: row.role as 'PRIMARY' | 'SECONDARY',
    }));
  }

  async upsertDaily(input: UpsertDailyInput): Promise<void> {
    const date = new Date(`${input.date}T00:00:00.000Z`);
    await this.prisma.analyticsDailySnapshot.upsert({
      where: {
        userId_date: { userId: input.userId, date },
      },
      create: {
        userId: input.userId,
        date,
        workoutCount: input.workoutCount,
        totalVolumeKg: new Prisma.Decimal(input.totalVolumeKg),
        totalDurationSec: input.totalDurationSec,
        setCount: input.setCount,
      },
      update: {
        workoutCount: input.workoutCount,
        totalVolumeKg: new Prisma.Decimal(input.totalVolumeKg),
        totalDurationSec: input.totalDurationSec,
        setCount: input.setCount,
      },
    });
  }

  async upsertWeekly(input: UpsertWeeklyInput): Promise<void> {
    const weekStart = new Date(`${input.weekStart}T00:00:00.000Z`);
    await this.prisma.analyticsWeeklySnapshot.upsert({
      where: {
        userId_weekStart: { userId: input.userId, weekStart },
      },
      create: {
        userId: input.userId,
        weekStart,
        workoutCount: input.workoutCount,
        totalVolumeKg: new Prisma.Decimal(input.totalVolumeKg),
        totalDurationSec: input.totalDurationSec,
        trainingDays: input.trainingDays,
      },
      update: {
        workoutCount: input.workoutCount,
        totalVolumeKg: new Prisma.Decimal(input.totalVolumeKg),
        totalDurationSec: input.totalDurationSec,
        trainingDays: input.trainingDays,
      },
    });
  }

  async replaceMuscleVolumeForDay(
    userId: string,
    date: string,
    rows: UpsertMuscleVolumeInput[],
  ): Promise<void> {
    const day = new Date(`${date}T00:00:00.000Z`);
    await this.prisma.$transaction(async (tx) => {
      await tx.muscleVolumeDaily.deleteMany({
        where: { userId, date: day },
      });
      if (rows.length === 0) return;
      await tx.muscleVolumeDaily.createMany({
        data: rows.map((row) => ({
          userId: row.userId,
          muscleGroupId: row.muscleGroupId,
          date: day,
          volumeKg: new Prisma.Decimal(row.volumeKg),
          setCount: row.setCount,
        })),
      });
    });
  }

  async upsertExerciseStat(input: UpsertExerciseStatInput): Promise<void> {
    await this.prisma.exerciseStat.upsert({
      where: {
        userId_exerciseId: {
          userId: input.userId,
          exerciseId: input.exerciseId,
        },
      },
      create: {
        userId: input.userId,
        exerciseId: input.exerciseId,
        lastWeightKg:
          input.lastWeightKg === null
            ? null
            : new Prisma.Decimal(input.lastWeightKg),
        lastReps: input.lastReps,
        lastVolumeKg:
          input.lastVolumeKg === null
            ? null
            : new Prisma.Decimal(input.lastVolumeKg),
        bestWeightKg:
          input.bestWeightKg === null
            ? null
            : new Prisma.Decimal(input.bestWeightKg),
        bestEstimated1rmKg:
          input.bestEstimated1rmKg === null
            ? null
            : new Prisma.Decimal(input.bestEstimated1rmKg),
        totalSessions: input.totalSessions,
        lastPerformedAt: input.lastPerformedAt,
      },
      update: {
        lastWeightKg:
          input.lastWeightKg === null
            ? null
            : new Prisma.Decimal(input.lastWeightKg),
        lastReps: input.lastReps,
        lastVolumeKg:
          input.lastVolumeKg === null
            ? null
            : new Prisma.Decimal(input.lastVolumeKg),
        bestWeightKg:
          input.bestWeightKg === null
            ? null
            : new Prisma.Decimal(input.bestWeightKg),
        bestEstimated1rmKg:
          input.bestEstimated1rmKg === null
            ? null
            : new Prisma.Decimal(input.bestEstimated1rmKg),
        totalSessions: input.totalSessions,
        lastPerformedAt: input.lastPerformedAt,
      },
    });
  }

  async getExerciseStat(
    userId: string,
    exerciseId: string,
  ): Promise<ExerciseStatRecord | null> {
    const row = await this.prisma.exerciseStat.findUnique({
      where: { userId_exerciseId: { userId, exerciseId } },
      include: { exercise: { select: { name: true, slug: true } } },
    });
    if (!row) return null;
    return {
      exerciseId: row.exerciseId,
      exerciseName: row.exercise.name,
      exerciseSlug: row.exercise.slug,
      lastWeightKg: row.lastWeightKg ? Number(row.lastWeightKg) : null,
      lastReps: row.lastReps,
      lastVolumeKg: row.lastVolumeKg ? Number(row.lastVolumeKg) : null,
      bestWeightKg: row.bestWeightKg ? Number(row.bestWeightKg) : null,
      bestEstimated1rmKg: row.bestEstimated1rmKg
        ? Number(row.bestEstimated1rmKg)
        : null,
      totalSessions: row.totalSessions,
      lastPerformedAt: row.lastPerformedAt,
    };
  }

  async listDaily(
    userId: string,
    from: string,
    to: string,
  ): Promise<DailySnapshotRecord[]> {
    const rows = await this.prisma.analyticsDailySnapshot.findMany({
      where: {
        userId,
        date: {
          gte: new Date(`${from}T00:00:00.000Z`),
          lte: new Date(`${to}T00:00:00.000Z`),
        },
      },
      orderBy: { date: 'asc' },
    });
    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      workoutCount: row.workoutCount,
      totalVolumeKg: Number(row.totalVolumeKg),
      totalDurationSec: row.totalDurationSec,
      setCount: row.setCount,
    }));
  }

  async listWeekly(
    userId: string,
    fromWeekStart: string,
    toWeekStart: string,
  ): Promise<WeeklySnapshotRecord[]> {
    const rows = await this.prisma.analyticsWeeklySnapshot.findMany({
      where: {
        userId,
        weekStart: {
          gte: new Date(`${fromWeekStart}T00:00:00.000Z`),
          lte: new Date(`${toWeekStart}T00:00:00.000Z`),
        },
      },
      orderBy: { weekStart: 'asc' },
    });
    return rows.map((row) => ({
      weekStart: row.weekStart.toISOString().slice(0, 10),
      workoutCount: row.workoutCount,
      totalVolumeKg: Number(row.totalVolumeKg),
      totalDurationSec: row.totalDurationSec,
      trainingDays: row.trainingDays,
    }));
  }

  async listMuscleVolume(
    userId: string,
    from: string,
    to: string,
  ): Promise<MuscleVolumeRecord[]> {
    const rows = await this.prisma.muscleVolumeDaily.findMany({
      where: {
        userId,
        date: {
          gte: new Date(`${from}T00:00:00.000Z`),
          lte: new Date(`${to}T00:00:00.000Z`),
        },
      },
      include: { muscleGroup: { select: { name: true, slug: true } } },
      orderBy: { date: 'asc' },
    });
    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      muscleGroupId: row.muscleGroupId,
      muscleGroupName: row.muscleGroup.name,
      muscleGroupSlug: row.muscleGroup.slug,
      volumeKg: Number(row.volumeKg),
      setCount: row.setCount,
    }));
  }

  async listTrainedDateKeys(
    userId: string,
    timeZone: string,
  ): Promise<string[]> {
    const rows = await this.prisma.workout.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      select: { completedAt: true },
    });
    const keys = new Set<string>();
    for (const row of rows) {
      keys.add(dateKeyInTimeZone(row.completedAt!, timeZone));
    }
    return [...keys];
  }

  async countCompletedWorkouts(userId: string): Promise<number> {
    return this.prisma.workout.count({
      where: { userId, deletedAt: null, status: 'COMPLETED' },
    });
  }

  async countSessionsForExercise(
    userId: string,
    exerciseId: string,
  ): Promise<number> {
    return this.prisma.workout.count({
      where: {
        userId,
        deletedAt: null,
        status: 'COMPLETED',
        exercises: { some: { exerciseId } },
      },
    });
  }

  async exerciseVolumeSeries(
    userId: string,
    exerciseId: string,
    fromUtc: Date,
    toUtc: Date,
    timeZone: string,
  ): Promise<ExerciseSeriesPoint[]> {
    const rows = await this.prisma.workout.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'COMPLETED',
        completedAt: { gte: fromUtc, lt: toUtc },
        exercises: { some: { exerciseId } },
      },
      include: {
        exercises: {
          where: { exerciseId },
          include: { sets: true },
        },
      },
    });

    const byDate = new Map<string, ExerciseSeriesPoint>();
    for (const workout of rows) {
      const date = dateKeyInTimeZone(workout.completedAt!, timeZone);
      const point = byDate.get(date) ?? {
        date,
        volumeKg: 0,
        bestEstimated1rmKg: null as number | null,
        bestWeightKg: null as number | null,
        setCount: 0,
      };
      for (const exercise of workout.exercises) {
        for (const set of exercise.sets) {
          if (set.isWarmup) continue;
          const weightKg = set.weightKg ? Number(set.weightKg) : null;
          const reps = set.reps;
          point.volumeKg += setVolumeKg(weightKg, reps);
          if (!set.isWarmup) point.setCount += 1;
          if (weightKg !== null) {
            point.bestWeightKg =
              point.bestWeightKg === null
                ? weightKg
                : Math.max(point.bestWeightKg, weightKg);
          }
          if (weightKg !== null && reps !== null) {
            const e1rm = estimated1RmKg(weightKg, reps);
            if (e1rm !== null) {
              point.bestEstimated1rmKg =
                point.bestEstimated1rmKg === null
                  ? e1rm
                  : Math.max(point.bestEstimated1rmKg, e1rm);
            }
          }
        }
      }
      point.volumeKg = Math.round(point.volumeKg * 100) / 100;
      byDate.set(date, point);
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
