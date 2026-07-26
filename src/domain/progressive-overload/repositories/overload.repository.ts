import { OverloadGoal, OverloadSession } from '../overload.algorithm';

export const OVERLOAD_REPOSITORY = Symbol('OVERLOAD_REPOSITORY');

export interface OverloadExerciseMeta {
  exerciseId: string;
  name: string;
  slug: string;
  equipmentSlug: string | null;
}

export interface OverloadUserContext {
  fitnessGoal: OverloadGoal | null;
  preferredWeightUnit: 'KG' | 'LB';
}

/**
 * Port for progressive-overload history reads.
 */
export interface OverloadRepository {
  getUserContext(userId: string): Promise<OverloadUserContext>;
  listRecentExerciseIds(userId: string, withinDays: number): Promise<string[]>;
  getExerciseMeta(exerciseId: string): Promise<OverloadExerciseMeta | null>;
  getRecentSessions(
    userId: string,
    exerciseId: string,
    limit: number,
  ): Promise<OverloadSession[]>;
}
