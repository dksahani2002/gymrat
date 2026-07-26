import { Workout } from '../workout.entity';
import { WeightUnit, WorkoutSource, WorkoutStatus } from '../workout.enums';

export const WORKOUT_REPOSITORY = Symbol('WORKOUT_REPOSITORY');

export interface WorkoutSetInput {
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  weightUnit?: WeightUnit;
  rpe?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  isWarmup?: boolean;
  isFailure?: boolean;
  notes?: string | null;
}

export interface WorkoutExerciseInput {
  exerciseId: string;
  position: number;
  notes?: string | null;
  sets: WorkoutSetInput[];
}

export interface CreateWorkoutInput {
  userId: string;
  title?: string | null;
  notes?: string | null;
  source: WorkoutSource;
  status?: WorkoutStatus;
  startedAt: Date;
  completedAt?: Date | null;
  durationSec?: number | null;
  exercises: WorkoutExerciseInput[];
}

export interface UpdateWorkoutMetaInput {
  title?: string | null;
  notes?: string | null;
  startedAt?: Date;
}

export interface ListWorkoutsFilters {
  userId: string;
  status?: WorkoutStatus;
  from?: Date;
  to?: Date;
  cursor?: string | null;
  limit: number;
}

export interface ListWorkoutsResult {
  items: Workout[];
  nextCursor: string | null;
}

/**
 * Port for workout aggregate persistence.
 */
export interface WorkoutRepository {
  create(input: CreateWorkoutInput): Promise<Workout>;
  findByIdForUser(id: string, userId: string): Promise<Workout | null>;
  list(filters: ListWorkoutsFilters): Promise<ListWorkoutsResult>;
  updateMeta(id: string, userId: string, input: UpdateWorkoutMetaInput): Promise<Workout>;
  replaceExercises(
    id: string,
    userId: string,
    exercises: WorkoutExerciseInput[],
  ): Promise<Workout>;
  softDelete(id: string, userId: string): Promise<void>;
  complete(
    id: string,
    userId: string,
    completedAt: Date,
    durationSec: number,
  ): Promise<Workout>;
  addExercise(
    workoutId: string,
    userId: string,
    input: WorkoutExerciseInput,
  ): Promise<Workout>;
  updateExercise(
    workoutId: string,
    workoutExerciseId: string,
    userId: string,
    input: { position?: number; notes?: string | null },
  ): Promise<Workout>;
  removeExercise(
    workoutId: string,
    workoutExerciseId: string,
    userId: string,
  ): Promise<Workout>;
  addSet(
    workoutId: string,
    workoutExerciseId: string,
    userId: string,
    input: WorkoutSetInput,
  ): Promise<Workout>;
  updateSet(
    workoutId: string,
    setId: string,
    userId: string,
    input: Partial<WorkoutSetInput>,
  ): Promise<Workout>;
  removeSet(workoutId: string, setId: string, userId: string): Promise<Workout>;
  findByIdempotencyKey(userId: string, key: string): Promise<Workout | null>;
  saveIdempotencyKey(
    userId: string,
    key: string,
    workoutId: string,
    expiresAt: Date,
  ): Promise<void>;
  exerciseExists(exerciseId: string): Promise<boolean>;
}
