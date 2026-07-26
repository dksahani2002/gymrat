import { WeightUnit, WorkoutSource, WorkoutStatus } from '../../../domain/workout/workout.enums';

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface WorkoutSetView {
  id: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  weightUnit: WeightUnit;
  weightKg: number | null;
  rpe: number | null;
  durationSec: number | null;
  distanceM: number | null;
  isWarmup: boolean;
  isFailure: boolean;
  notes: string | null;
}

export interface WorkoutExerciseView {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  position: number;
  notes: string | null;
  sets: WorkoutSetView[];
}

export interface WorkoutView {
  id: string;
  userId: string;
  title: string | null;
  notes: string | null;
  source: WorkoutSource;
  status: WorkoutStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationSec: number | null;
  exercises: WorkoutExerciseView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutSetCommandInput {
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

export interface WorkoutExerciseCommandInput {
  exerciseId: string;
  position: number;
  notes?: string | null;
  sets: WorkoutSetCommandInput[];
}

export interface CreateWorkoutCommand {
  userId: string;
  title?: string | null;
  notes?: string | null;
  source?: WorkoutSource;
  startedAt?: string;
  completed?: boolean;
  idempotencyKey?: string;
  exercises: WorkoutExerciseCommandInput[];
  context: RequestContext;
}

export interface ListWorkoutsQuery {
  userId: string;
  status?: WorkoutStatus;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface UpdateWorkoutCommand {
  userId: string;
  workoutId: string;
  title?: string | null;
  notes?: string | null;
  startedAt?: string;
  exercises?: WorkoutExerciseCommandInput[];
  context: RequestContext;
}
