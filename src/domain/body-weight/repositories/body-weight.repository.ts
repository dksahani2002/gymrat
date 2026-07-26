import { BodyWeightEntry, BodyWeightUnit } from '../body-weight-entry.entity';

export const BODY_WEIGHT_REPOSITORY = Symbol('BODY_WEIGHT_REPOSITORY');

export interface CreateBodyWeightInput {
  userId: string;
  weight: number;
  unit: BodyWeightUnit;
  weightKg: number;
  recordedAt: Date;
  notes?: string | null;
}

export interface ListBodyWeightFilters {
  userId: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: string | null;
}

export interface ListBodyWeightResult {
  items: BodyWeightEntry[];
  nextCursor: string | null;
}

export interface BodyWeightRepository {
  create(input: CreateBodyWeightInput): Promise<BodyWeightEntry>;
  list(filters: ListBodyWeightFilters): Promise<ListBodyWeightResult>;
  findByIdForUser(id: string, userId: string): Promise<BodyWeightEntry | null>;
  softDelete(id: string, userId: string): Promise<void>;
  listInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<BodyWeightEntry[]>;
}
