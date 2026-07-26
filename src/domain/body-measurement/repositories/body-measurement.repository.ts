import {
  BodyMeasurement,
  MeasurementMap,
} from '../body-measurement.entity';

export const BODY_MEASUREMENT_REPOSITORY = Symbol('BODY_MEASUREMENT_REPOSITORY');

export interface CreateBodyMeasurementInput {
  userId: string;
  measurements: MeasurementMap;
  recordedAt: Date;
  notes?: string | null;
}

export interface ListBodyMeasurementFilters {
  userId: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: string | null;
}

export interface ListBodyMeasurementResult {
  items: BodyMeasurement[];
  nextCursor: string | null;
}

export interface BodyMeasurementRepository {
  create(input: CreateBodyMeasurementInput): Promise<BodyMeasurement>;
  list(filters: ListBodyMeasurementFilters): Promise<ListBodyMeasurementResult>;
  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<BodyMeasurement | null>;
  softDelete(id: string, userId: string): Promise<void>;
}
