import { Entity } from '../common/entity.base';
import { GoalStatus, GoalType } from './goal.enums';

export interface GoalProps {
  id: string;
  userId: string;
  type: GoalType;
  title: string;
  targetValue: number | null;
  targetUnit: string | null;
  exerciseId: string | null;
  exerciseName?: string | null;
  exerciseSlug?: string | null;
  status: GoalStatus;
  startsAt: Date;
  targetDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * User training / body goal definition.
 */
export class Goal extends Entity {
  readonly userId: string;
  readonly type: GoalType;
  readonly title: string;
  readonly targetValue: number | null;
  readonly targetUnit: string | null;
  readonly exerciseId: string | null;
  readonly exerciseName?: string | null;
  readonly exerciseSlug?: string | null;
  readonly status: GoalStatus;
  readonly startsAt: Date;
  readonly targetDate: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: GoalProps) {
    super(props.id);
    this.userId = props.userId;
    this.type = props.type;
    this.title = props.title;
    this.targetValue = props.targetValue;
    this.targetUnit = props.targetUnit;
    this.exerciseId = props.exerciseId;
    this.exerciseName = props.exerciseName;
    this.exerciseSlug = props.exerciseSlug;
    this.status = props.status;
    this.startsAt = props.startsAt;
    this.targetDate = props.targetDate;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: GoalProps): Goal {
    return new Goal(props);
  }
}
