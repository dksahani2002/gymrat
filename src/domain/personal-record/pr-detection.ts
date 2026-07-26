import { Workout, WorkoutExerciseProps, WorkoutSetProps } from '../workout/workout.entity';
import { estimated1RmKg } from '../../shared/utils/epley.utils';
import { PrType } from './pr-type.enum';

export interface PrCandidate {
  exerciseId: string;
  exerciseName: string;
  type: PrType;
  value: number;
  unit: string;
}

export { estimated1RmKg };

function workingSets(sets: WorkoutSetProps[]): WorkoutSetProps[] {
  return sets.filter((set) => !set.isWarmup);
}

function candidatesForExercise(exercise: WorkoutExerciseProps): PrCandidate[] {
  const sets = workingSets(exercise.sets);
  if (sets.length === 0) {
    return [];
  }

  const out: PrCandidate[] = [];
  let maxWeight: number | null = null;
  let maxReps: number | null = null;
  let volume = 0;
  let bestE1rm: number | null = null;

  for (const set of sets) {
    const weightKg = set.weightKg;
    const reps = set.reps;

    if (weightKg !== null && weightKg > 0) {
      maxWeight = maxWeight === null ? weightKg : Math.max(maxWeight, weightKg);
    }
    if (reps !== null && reps > 0) {
      maxReps = maxReps === null ? reps : Math.max(maxReps, reps);
    }
    if (weightKg !== null && reps !== null && reps > 0) {
      volume += weightKg * reps;
      const e1rm = estimated1RmKg(weightKg, reps);
      if (e1rm !== null) {
        bestE1rm = bestE1rm === null ? e1rm : Math.max(bestE1rm, e1rm);
      }
    }
  }

  if (maxWeight !== null) {
    out.push({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      type: PrType.MAX_WEIGHT,
      value: Math.round(maxWeight * 100) / 100,
      unit: 'KG',
    });
  }
  if (maxReps !== null) {
    out.push({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      type: PrType.MAX_REPS,
      value: maxReps,
      unit: 'REPS',
    });
  }
  if (volume > 0) {
    out.push({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      type: PrType.MAX_VOLUME,
      value: Math.round(volume * 100) / 100,
      unit: 'KG',
    });
  }
  if (bestE1rm !== null) {
    out.push({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      type: PrType.ESTIMATED_1RM,
      value: bestE1rm,
      unit: 'KG',
    });
  }

  return out;
}

/**
 * Derive PR candidates from a completed workout (working sets only).
 */
export function detectPrCandidates(workout: Workout): PrCandidate[] {
  return workout.exercises.flatMap((exercise) => candidatesForExercise(exercise));
}

/**
 * Keep candidates that beat the current best value for the same exercise+type.
 */
export function filterNewPrs(
  candidates: PrCandidate[],
  bests: Array<{ exerciseId: string; type: PrType; value: number }>,
): PrCandidate[] {
  const bestMap = new Map<string, number>();
  for (const best of bests) {
    bestMap.set(`${best.exerciseId}:${best.type}`, best.value);
  }

  return candidates.filter((candidate) => {
    const key = `${candidate.exerciseId}:${candidate.type}`;
    const previous = bestMap.get(key);
    return previous === undefined || candidate.value > previous;
  });
}
