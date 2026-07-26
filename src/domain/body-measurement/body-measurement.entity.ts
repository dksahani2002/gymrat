import { Entity } from '../common/entity.base';

/** Circumference values stored in centimeters. */
export type MeasurementMap = Record<string, number>;

export interface BodyMeasurementProps {
  id: string;
  userId: string;
  measurements: MeasurementMap;
  recordedAt: Date;
  notes: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

/**
 * Soft-deletable body circumference measurement entry.
 */
export class BodyMeasurement extends Entity {
  readonly userId: string;
  readonly measurements: MeasurementMap;
  readonly recordedAt: Date;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: BodyMeasurementProps) {
    super(props.id);
    this.userId = props.userId;
    this.measurements = props.measurements;
    this.recordedAt = props.recordedAt;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: BodyMeasurementProps): BodyMeasurement {
    return new BodyMeasurement(props);
  }
}

export const KNOWN_MEASUREMENT_KEYS = [
  'chest',
  'waist',
  'hips',
  'neck',
  'shoulders',
  'left_arm',
  'right_arm',
  'left_forearm',
  'right_forearm',
  'left_thigh',
  'right_thigh',
  'left_calf',
  'right_calf',
] as const;
