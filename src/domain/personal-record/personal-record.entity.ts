import { Entity } from '../common/entity.base';
import { PrType } from './pr-type.enum';

export interface PersonalRecordProps {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName?: string;
  exerciseSlug?: string;
  type: PrType;
  value: number;
  unit: string | null;
  workoutId: string | null;
  achievedAt: Date;
  createdAt: Date;
}

/**
 * Append-only personal record achievement.
 */
export class PersonalRecord extends Entity {
  readonly userId: string;
  readonly exerciseId: string;
  readonly exerciseName?: string;
  readonly exerciseSlug?: string;
  readonly type: PrType;
  readonly value: number;
  readonly unit: string | null;
  readonly workoutId: string | null;
  readonly achievedAt: Date;
  readonly createdAt: Date;

  private constructor(props: PersonalRecordProps) {
    super(props.id);
    this.userId = props.userId;
    this.exerciseId = props.exerciseId;
    this.exerciseName = props.exerciseName;
    this.exerciseSlug = props.exerciseSlug;
    this.type = props.type;
    this.value = props.value;
    this.unit = props.unit;
    this.workoutId = props.workoutId;
    this.achievedAt = props.achievedAt;
    this.createdAt = props.createdAt;
  }

  static create(props: PersonalRecordProps): PersonalRecord {
    return new PersonalRecord(props);
  }
}
