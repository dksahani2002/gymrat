import { Entity } from '../common/entity.base';
import { WeightUnit, WorkoutSource, WorkoutStatus } from './workout.enums';

export interface WorkoutSetProps {
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

export interface WorkoutExerciseProps {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  position: number;
  notes: string | null;
  sets: WorkoutSetProps[];
}

export interface WorkoutProps {
  id: string;
  userId: string;
  title: string | null;
  notes: string | null;
  source: WorkoutSource;
  status: WorkoutStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationSec: number | null;
  exercises: WorkoutExerciseProps[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Workout aggregate root (session with ordered exercises and sets).
 */
export class Workout extends Entity {
  readonly userId: string;
  readonly title: string | null;
  readonly notes: string | null;
  readonly source: WorkoutSource;
  readonly status: WorkoutStatus;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly durationSec: number | null;
  readonly exercises: WorkoutExerciseProps[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: WorkoutProps) {
    super(props.id);
    this.userId = props.userId;
    this.title = props.title;
    this.notes = props.notes;
    this.source = props.source;
    this.status = props.status;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.durationSec = props.durationSec;
    this.exercises = props.exercises;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: WorkoutProps): Workout {
    return new Workout(props);
  }

  get workingSetCount(): number {
    return this.exercises.reduce(
      (sum, exercise) =>
        sum + exercise.sets.filter((set) => !set.isWarmup).length,
      0,
    );
  }

  get isOwnedBy(): (userId: string) => boolean {
    return (userId: string) => this.userId === userId;
  }
}
