import { Entity } from '../common/entity.base';

export interface PlannedWorkoutProps {
  id: string;
  userId: string;
  title: string | null;
  plannedDate: string;
  notes: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

/**
 * Lightweight calendar marker for a planned training day.
 */
export class PlannedWorkout extends Entity {
  readonly userId: string;
  readonly title: string | null;
  /** YYYY-MM-DD */
  readonly plannedDate: string;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: PlannedWorkoutProps) {
    super(props.id);
    this.userId = props.userId;
    this.title = props.title;
    this.plannedDate = props.plannedDate;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: PlannedWorkoutProps): PlannedWorkout {
    return new PlannedWorkout(props);
  }
}
