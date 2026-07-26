import { AnalyticsApplicationService } from './analytics.application-service';

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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsApplicationService(
      analytics as never,
      redis as never,
    );
  });

  it('recomputes daily/weekly/muscle/exercise stats for a completed day', async () => {
    analytics.getUserTimezone.mockResolvedValue('UTC');
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
    analytics.listDaily.mockResolvedValue([
      {
        date: '2026-07-26',
        workoutCount: 1,
        totalVolumeKg: 500,
        totalDurationSec: 3600,
        setCount: 1,
      },
    ]);
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

  it('returns overview with streak and consistency', async () => {
    redis.raw.get.mockResolvedValue(null);
    analytics.getUserTimezone.mockResolvedValue('UTC');
    analytics.listTrainedDateKeys.mockResolvedValue([
      '2026-07-25',
      '2026-07-26',
    ]);
    analytics.listDaily.mockResolvedValue([
      {
        date: '2026-07-26',
        workoutCount: 1,
        totalVolumeKg: 500,
        totalDurationSec: 3600,
        setCount: 1,
      },
    ]);
    analytics.countCompletedWorkouts.mockResolvedValue(2);

    // Freeze "today" via listTrainedDateKeys + week keys based on real now —
    // overview uses dateKeyInTimeZone(new Date()). Stub listDaily for any range.
    analytics.listDaily.mockImplementation(async () => [
      {
        date: '2026-07-26',
        workoutCount: 1,
        totalVolumeKg: 500,
        totalDurationSec: 3600,
        setCount: 1,
      },
    ]);

    const result = await service.overview('user-1');
    expect(result.totalCompletedWorkouts).toBe(2);
    expect(result.timezone).toBe('UTC');
    expect(redis.raw.set).toHaveBeenCalled();
  });
});
