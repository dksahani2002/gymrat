import { PersonalRecord } from '../personal-record.entity';
import { PrType } from '../pr-type.enum';

export const PERSONAL_RECORD_REPOSITORY = Symbol('PERSONAL_RECORD_REPOSITORY');

export interface CreatePersonalRecordInput {
  userId: string;
  exerciseId: string;
  type: PrType;
  value: number;
  unit?: string | null;
  workoutId?: string | null;
  achievedAt: Date;
}

export interface ListPersonalRecordsFilters {
  userId: string;
  exerciseId?: string;
  type?: PrType;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: string | null;
}

export interface ListPersonalRecordsResult {
  items: PersonalRecord[];
  nextCursor: string | null;
}

export interface BestPersonalRecordKey {
  exerciseId: string;
  type: PrType;
}

/**
 * Port for personal record ledger persistence.
 */
export interface PersonalRecordRepository {
  createMany(inputs: CreatePersonalRecordInput[]): Promise<PersonalRecord[]>;
  list(filters: ListPersonalRecordsFilters): Promise<ListPersonalRecordsResult>;
  /**
   * Current best (max value) per exercise+type for a user.
   * Optional exerciseIds filter for detection hot path.
   */
  findBests(userId: string, exerciseIds?: string[]): Promise<PersonalRecord[]>;
}
