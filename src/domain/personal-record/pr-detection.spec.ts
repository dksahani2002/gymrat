import { Workout } from '../workout/workout.entity';
import { WeightUnit, WorkoutSource, WorkoutStatus } from '../workout/workout.enums';
import {
  detectPrCandidates,
  estimated1RmKg,
  filterNewPrs,
} from './pr-detection';
import { PrType } from './pr-type.enum';

function makeWorkout(
  sets: Array<{
    weightKg?: number | null;
    reps?: number | null;
    isWarmup?: boolean;
  }>,
): Workout {
  return Workout.create({
    id: 'wo-1',
    userId: 'user-1',
    title: 'Test',
    notes: null,
    source: WorkoutSource.MANUAL,
    status: WorkoutStatus.COMPLETED,
    startedAt: new Date(),
    completedAt: new Date(),
    durationSec: 3600,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    exercises: [
      {
        id: 'we-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exerciseSlug: 'bench-press',
        position: 1,
        notes: null,
        sets: sets.map((set, index) => ({
          id: `set-${index}`,
          setNumber: index + 1,
          reps: set.reps ?? null,
          weight: set.weightKg ?? null,
          weightUnit: WeightUnit.KG,
          weightKg: set.weightKg ?? null,
          rpe: null,
          durationSec: null,
          distanceM: null,
          isWarmup: set.isWarmup ?? false,
          isFailure: false,
          notes: null,
        })),
      },
    ],
  });
}

describe('pr-detection', () => {
  it('computes Epley e1RM for reps 1-12', () => {
    expect(estimated1RmKg(100, 5)).toBeCloseTo(116.67, 1);
    expect(estimated1RmKg(100, 13)).toBeNull();
    expect(estimated1RmKg(0, 5)).toBeNull();
  });

  it('detects weight, reps, volume, and e1RM from working sets', () => {
    const workout = makeWorkout([
      { weightKg: 60, reps: 5, isWarmup: true },
      { weightKg: 80, reps: 5 },
      { weightKg: 85, reps: 3 },
    ]);

    const candidates = detectPrCandidates(workout);
    const byType = Object.fromEntries(
      candidates.map((c) => [c.type, c.value]),
    );

    expect(byType[PrType.MAX_WEIGHT]).toBe(85);
    expect(byType[PrType.MAX_REPS]).toBe(5);
    expect(byType[PrType.MAX_VOLUME]).toBe(80 * 5 + 85 * 3);
    expect(byType[PrType.ESTIMATED_1RM]).toBe(estimated1RmKg(85, 3)!);
  });

  it('ignores workouts with only warmups', () => {
    const workout = makeWorkout([{ weightKg: 40, reps: 10, isWarmup: true }]);
    expect(detectPrCandidates(workout)).toEqual([]);
  });

  it('filters candidates that do not beat prior bests', () => {
    const candidates = detectPrCandidates(
      makeWorkout([{ weightKg: 80, reps: 5 }]),
    );
    const fresh = filterNewPrs(candidates, []);
    expect(fresh).toHaveLength(4);

    const noImprove = filterNewPrs(candidates, [
      { exerciseId: 'ex-1', type: PrType.MAX_WEIGHT, value: 90 },
      { exerciseId: 'ex-1', type: PrType.MAX_REPS, value: 10 },
      { exerciseId: 'ex-1', type: PrType.MAX_VOLUME, value: 1000 },
      { exerciseId: 'ex-1', type: PrType.ESTIMATED_1RM, value: 200 },
    ]);
    expect(noImprove).toHaveLength(0);

    const weightOnly = filterNewPrs(candidates, [
      { exerciseId: 'ex-1', type: PrType.MAX_WEIGHT, value: 70 },
      { exerciseId: 'ex-1', type: PrType.MAX_REPS, value: 10 },
      { exerciseId: 'ex-1', type: PrType.MAX_VOLUME, value: 1000 },
      { exerciseId: 'ex-1', type: PrType.ESTIMATED_1RM, value: 200 },
    ]);
    expect(weightOnly.map((c) => c.type)).toEqual([PrType.MAX_WEIGHT]);
  });
});
