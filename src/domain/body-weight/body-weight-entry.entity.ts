import { Entity } from '../common/entity.base';

export type BodyWeightUnit = 'KG' | 'LB';

export interface BodyWeightEntryProps {
  id: string;
  userId: string;
  weight: number;
  unit: BodyWeightUnit;
  weightKg: number;
  recordedAt: Date;
  notes: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

/**
 * Soft-deletable body weight log entry.
 */
export class BodyWeightEntry extends Entity {
  readonly userId: string;
  readonly weight: number;
  readonly unit: BodyWeightUnit;
  readonly weightKg: number;
  readonly recordedAt: Date;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: BodyWeightEntryProps) {
    super(props.id);
    this.userId = props.userId;
    this.weight = props.weight;
    this.unit = props.unit;
    this.weightKg = props.weightKg;
    this.recordedAt = props.recordedAt;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: BodyWeightEntryProps): BodyWeightEntry {
    return new BodyWeightEntry(props);
  }
}
