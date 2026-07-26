import { ProgressiveOverloadApplicationService } from './progressive-overload.application-service';

describe('ProgressiveOverloadApplicationService', () => {
  const overload = {
    getUserContext: jest.fn(),
    listRecentExerciseIds: jest.fn(),
    getExerciseMeta: jest.fn(),
    getRecentSessions: jest.fn(),
  };
  const redis = {
    raw: {
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    },
  };
  const config = {
    get: jest.fn((key: string, fallback: unknown) => {
      const map: Record<string, unknown> = {
        'overload.recentDays': 28,
        'overload.cacheTtlSec': 900,
        'overload.lookbackSessions': 3,
        'overload.barbellIncrementKg': 2.5,
        'overload.dumbbellIncrementKg': 2,
        'overload.deloadConsecutiveFails': 2,
        'overload.deloadPercent': 0.1,
        'overload.detrainDays': 14,
      };
      return map[key] ?? fallback;
    }),
  };

  let service: ProgressiveOverloadApplicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProgressiveOverloadApplicationService(
      overload as never,
      redis as never,
      config as never,
    );
  });

  it('computes and caches a per-exercise recommendation', async () => {
    redis.raw.get.mockResolvedValue(null);
    overload.getExerciseMeta.mockResolvedValue({
      exerciseId: 'ex-1',
      name: 'Bench Press',
      slug: 'bench-press',
      equipmentSlug: 'barbell',
    });
    overload.getUserContext.mockResolvedValue({
      fitnessGoal: 'BUILD_MUSCLE',
      preferredWeightUnit: 'KG',
    });
    overload.getRecentSessions.mockResolvedValue([
      {
        performedAt: new Date('2026-07-20T12:00:00Z'),
        sets: [
          {
            weightKg: 80,
            reps: 5,
            rpe: null,
            isWarmup: false,
            isFailure: false,
          },
        ],
      },
    ]);

    const result = await service.getForExercise('user-1', 'ex-1');

    expect(result.exerciseName).toBe('Bench Press');
    expect(result.suggestion?.weight).toBe(82.5);
    expect(result.suggestion?.weightUnit).toBe('KG');
    expect(redis.raw.set).toHaveBeenCalled();
  });

  it('converts suggestion to LB when preferred', async () => {
    redis.raw.get.mockResolvedValue(null);
    overload.getExerciseMeta.mockResolvedValue({
      exerciseId: 'ex-1',
      name: 'Bench Press',
      slug: 'bench-press',
      equipmentSlug: 'barbell',
    });
    overload.getUserContext.mockResolvedValue({
      fitnessGoal: 'BUILD_MUSCLE',
      preferredWeightUnit: 'LB',
    });
    overload.getRecentSessions.mockResolvedValue([
      {
        performedAt: new Date('2026-07-20T12:00:00Z'),
        sets: [
          {
            weightKg: 80,
            reps: 5,
            rpe: null,
            isWarmup: false,
            isFailure: false,
          },
        ],
      },
    ]);

    const result = await service.getForExercise('user-1', 'ex-1');
    expect(result.suggestion?.weightUnit).toBe('LB');
    expect(result.suggestion?.weightKg).toBe(82.5);
    expect(result.suggestion?.weight).toBeGreaterThan(180);
  });

  it('invalidates redis keys for a user', async () => {
    redis.raw.keys.mockResolvedValue([
      'overload:user-1:all',
      'overload:user-1:ex:ex-1',
    ]);
    await service.invalidateUser('user-1');
    expect(redis.raw.del).toHaveBeenCalledWith(
      'overload:user-1:all',
      'overload:user-1:ex:ex-1',
    );
  });
});
