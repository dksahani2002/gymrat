import { AnalyticsApplicationService } from './analytics.application-service';
import { BusinessError } from '../../shared/errors/base.error';

describe('AnalyticsApplicationService', () => {
  const analytics = {
    getUserTimezone: jest.fn(),
    findCompletedWorkoutsAround: jest.fn(),
    findExerciseMuscles: jest.fn(),
    upsertDaily: jest.fn(),
    upsertWeekly: jest.fn(),
    replaceMuscleVolumeForDay: jest.fn(),
    upsertExerciseStat: jest.fn(),
    getExerciseStat: jest.fn(),
    listDaily: jest.fn(),
    listWeekly: jest.fn(),
    listMuscleVolume: jest.fn(),
    listTrainedDateKeys: jest.fn(),
    countCompletedWorkouts: jest.fn(),
    countSessionsForExercise: jest.fn(),
    exerciseVolumeSeries: jest.fn(),
    listBodyWeightKg: jest.fn(),
  };

  const redis = {
    raw: {
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    },
  };

  let service: AnalyticsApplicationService;

  const dailyRow = (date: string, volume = 500) => ({
    date,
    workoutCount: 1,
    totalVolumeKg: volume,
    totalDurationSec: 3600,
    setCount: 2,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsApplicationService(
      analytics as never,
      redis as never,
    );
    analytics.getUserTimezone.mockResolvedValue('UTC');
    redis.raw.keys.mockResolvedValue([]);
  });

  it('recomputes daily/weekly/muscle/exercise stats for a completed day', async () => {
    analytics.findCompletedWorkoutsAround.mockResolvedValue([
      {
        id: 'wo-1',
        completedAt: new Date('2026-07-26T12:00:00.000Z'),
        durationSec: 3600,
        exercises: [
          {
            exerciseId: 'ex-1',
            sets: [
              { reps: 5, weightKg: 100, isWarmup: false },
              { reps: 5, weightKg: 40, isWarmup: true },
            ],
          },
        ],
      },
    ]);
    analytics.findExerciseMuscles.mockResolvedValue([
      { exerciseId: 'ex-1', muscleGroupId: 'm-chest', role: 'PRIMARY' },
      { exerciseId: 'ex-1', muscleGroupId: 'm-tri', role: 'SECONDARY' },
    ]);
    analytics.listDaily.mockResolvedValue([dailyRow('2026-07-26')]);
    analytics.getExerciseStat.mockResolvedValue(null);
    analytics.countSessionsForExercise.mockResolvedValue(1);
    redis.raw.keys.mockResolvedValue(['analytics:user-1:overview']);

    await service.recomputeForDate({
      userId: 'user-1',
      anchorAt: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(analytics.upsertDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-07-26',
        workoutCount: 1,
        totalVolumeKg: 500,
        setCount: 1,
      }),
    );
    expect(analytics.replaceMuscleVolumeForDay).toHaveBeenCalledWith(
      'user-1',
      '2026-07-26',
      expect.arrayContaining([
        expect.objectContaining({
          muscleGroupId: 'm-chest',
          volumeKg: 500,
        }),
        expect.objectContaining({
          muscleGroupId: 'm-tri',
          volumeKg: 250,
        }),
      ]),
    );
    expect(analytics.upsertWeekly).toHaveBeenCalled();
    expect(analytics.upsertExerciseStat).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: 'ex-1',
        lastVolumeKg: 500,
        totalSessions: 1,
      }),
    );
    expect(redis.raw.del).toHaveBeenCalled();
  });

  it('recomputes a date range idempotently', async () => {
    analytics.findCompletedWorkoutsAround.mockResolvedValue([]);
    analytics.findExerciseMuscles.mockResolvedValue([]);
    analytics.listDaily.mockResolvedValue([]);

    const result = await service.recomputeRange({
      userId: 'user-1',
      from: '2026-07-25',
      to: '2026-07-26',
    });

    expect(result.days).toBe(2);
    expect(analytics.upsertDaily).toHaveBeenCalledTimes(2);
  });

  it('returns overview with streak and consistency', async () => {
    redis.raw.get.mockResolvedValue(null);
    analytics.listTrainedDateKeys.mockResolvedValue([
      '2026-07-25',
      '2026-07-26',
    ]);
    analytics.countCompletedWorkouts.mockResolvedValue(2);
    analytics.listDaily.mockImplementation(async () => [
      dailyRow('2026-07-26'),
    ]);

    const result = await service.overview('user-1');
    expect(result.totalCompletedWorkouts).toBe(2);
    expect(result.timezone).toBe('UTC');
    expect(redis.raw.set).toHaveBeenCalled();
  });

  it('returns cached overview when present', async () => {
    redis.raw.get.mockResolvedValue(
      JSON.stringify({ streak: 3, totalCompletedWorkouts: 9 }),
    );
    const result = await service.overview('user-1');
    expect(result.streak).toBe(3);
    expect(analytics.getUserTimezone).not.toHaveBeenCalled();
  });

  it('builds volume series for day/week/month/year', async () => {
    analytics.listDaily.mockResolvedValue([
      dailyRow('2026-07-01', 100),
      dailyRow('2026-07-15', 200),
    ]);
    analytics.listWeekly.mockResolvedValue([
      {
        weekStart: '2026-06-29',
        workoutCount: 2,
        totalVolumeKg: 300,
        totalDurationSec: 7200,
        trainingDays: 2,
      },
    ]);

    const day = await service.volumeSeries({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-15',
      period: 'day',
    });
    expect(day.points).toHaveLength(2);

    const week = await service.volumeSeries({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-15',
      period: 'week',
    });
    expect(week.points[0].x).toBe('2026-06-29');

    const month = await service.volumeSeries({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-15',
      period: 'month',
    });
    expect(month.points[0]).toEqual(
      expect.objectContaining({ x: '2026-07', y: 300 }),
    );

    const year = await service.volumeSeries({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-15',
      period: 'year',
    });
    expect(year.points[0].x).toBe('2026');
  });

  it('returns exercise volume and estimated 1RM series', async () => {
    analytics.exerciseVolumeSeries.mockResolvedValue([
      {
        date: '2026-07-26',
        volumeKg: 500,
        setCount: 1,
        bestWeightKg: 100,
        bestEstimated1rmKg: 116.67,
      },
      {
        date: '2026-07-20',
        volumeKg: 400,
        setCount: 1,
        bestWeightKg: 90,
        bestEstimated1rmKg: null,
      },
    ]);

    const volume = await service.exerciseVolume({
      userId: 'user-1',
      exerciseId: 'ex-1',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(volume.points).toHaveLength(2);

    const e1rm = await service.estimated1rm({
      userId: 'user-1',
      exerciseId: 'ex-1',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(e1rm.points).toHaveLength(1);
    expect(e1rm.points[0].y).toBe(116.67);
  });

  it('aggregates muscle volume breakdown and series', async () => {
    analytics.listMuscleVolume.mockResolvedValue([
      {
        date: '2026-07-26',
        muscleGroupId: 'm-1',
        muscleGroupName: 'Chest',
        muscleGroupSlug: 'chest',
        volumeKg: 100,
        setCount: 2,
      },
      {
        date: '2026-07-25',
        muscleGroupId: 'm-1',
        muscleGroupName: 'Chest',
        muscleGroupSlug: 'chest',
        volumeKg: 50,
        setCount: 1,
      },
    ]);

    const breakdown = await service.muscleVolume({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(
      (breakdown as { items: Array<{ volumeKg: number }> }).items[0].volumeKg,
    ).toBe(150);

    const series = await service.muscleVolume({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-26',
      series: true,
    });
    expect((series as { points: unknown[] }).points).toHaveLength(2);
  });

  it('computes frequency, consistency, and duration', async () => {
    analytics.listDaily.mockResolvedValue([
      dailyRow('2026-07-01'),
      {
        date: '2026-07-02',
        workoutCount: 0,
        totalVolumeKg: 0,
        totalDurationSec: 0,
        setCount: 0,
      },
    ]);

    const freq = await service.frequency({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-02',
    });
    expect(freq.totalWorkouts).toBe(1);
    expect(freq.trainedDays).toBe(1);

    const consistency = await service.consistency({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-02',
      targetDays: 2,
    });
    expect(consistency.consistency).toBe(0.5);

    const duration = await service.duration({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-02',
    });
    expect(duration.points[0].y).toBe(3600);
  });

  it('builds chart payloads for supported types', async () => {
    analytics.listDaily.mockResolvedValue([dailyRow('2026-07-26')]);
    analytics.listMuscleVolume.mockResolvedValue([
      {
        date: '2026-07-26',
        muscleGroupId: 'm-1',
        muscleGroupName: 'Chest',
        muscleGroupSlug: 'chest',
        volumeKg: 100,
        setCount: 1,
      },
    ]);
    analytics.exerciseVolumeSeries.mockResolvedValue([
      {
        date: '2026-07-26',
        volumeKg: 500,
        setCount: 1,
        bestWeightKg: 100,
        bestEstimated1rmKg: 116,
      },
    ]);
    analytics.listBodyWeightKg.mockResolvedValue([
      { recordedAt: new Date('2026-07-26T08:00:00Z'), weightKg: 80 },
    ]);

    const volumeChart = await service.chart({
      userId: 'user-1',
      chartType: 'volume_over_time',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(volumeChart.points.length).toBeGreaterThan(0);

    const muscle = await service.chart({
      userId: 'user-1',
      chartType: 'muscle_volume_breakdown',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(muscle.points[0].x).toBe('chest');

    const muscleSeries = await service.chart({
      userId: 'user-1',
      chartType: 'muscle_volume_over_time',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(muscleSeries.points).toHaveLength(1);

    const heat = await service.chart({
      userId: 'user-1',
      chartType: 'frequency_heatmap',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(heat.unit).toBe('workouts');

    const e1rm = await service.chart({
      userId: 'user-1',
      chartType: 'e1rm_over_time',
      from: '2026-07-01',
      to: '2026-07-26',
      exerciseId: 'ex-1',
    });
    expect(e1rm.points[0].y).toBe(116);

    const duration = await service.chart({
      userId: 'user-1',
      chartType: 'duration_over_time',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(duration.unit).toBe('sec');

    const bw = await service.chart({
      userId: 'user-1',
      chartType: 'body_weight_over_time',
      from: '2026-07-01',
      to: '2026-07-26',
    });
    expect(bw.points[0].y).toBe(80);
  });

  it('validates chart and range inputs', async () => {
    await expect(
      service.volumeSeries({
        userId: 'user-1',
        from: 'bad',
        to: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(BusinessError);

    await expect(
      service.volumeSeries({
        userId: 'user-1',
        from: '2026-07-10',
        to: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(BusinessError);

    await expect(
      service.chart({
        userId: 'user-1',
        chartType: 'e1rm_over_time',
        from: '2026-07-01',
        to: '2026-07-26',
      }),
    ).rejects.toBeInstanceOf(BusinessError);

    await expect(
      service.chart({
        userId: 'user-1',
        chartType: 'not_a_chart' as never,
        from: '2026-07-01',
        to: '2026-07-26',
      }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('merges prior exercise bests when recomputing', async () => {
    analytics.findCompletedWorkoutsAround.mockResolvedValue([
      {
        id: 'wo-1',
        completedAt: new Date('2026-07-26T12:00:00.000Z'),
        durationSec: 1800,
        exercises: [
          {
            exerciseId: 'ex-1',
            sets: [{ reps: 3, weightKg: 110, isWarmup: false }],
          },
        ],
      },
    ]);
    analytics.findExerciseMuscles.mockResolvedValue([]);
    analytics.listDaily.mockResolvedValue([dailyRow('2026-07-26', 330)]);
    analytics.getExerciseStat.mockResolvedValue({
      bestWeightKg: 120,
      bestEstimated1rmKg: 140,
    });
    analytics.countSessionsForExercise.mockResolvedValue(5);

    await service.recomputeForDate({
      userId: 'user-1',
      anchorAt: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(analytics.upsertExerciseStat).toHaveBeenCalledWith(
      expect.objectContaining({
        bestWeightKg: 120,
        bestEstimated1rmKg: 140,
        totalSessions: 5,
      }),
    );
  });
});
