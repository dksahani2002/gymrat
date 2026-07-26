import { Goal } from '../goal.entity';
import { GoalStatus, GoalType } from '../goal.enums';

export const GOAL_REPOSITORY = Symbol('GOAL_REPOSITORY');

export interface CreateGoalInput {
  userId: string;
  type: GoalType;
  title: string;
  targetValue?: number | null;
  targetUnit?: string | null;
  exerciseId?: string | null;
  startsAt: Date;
  targetDate?: Date | null;
}

export interface UpdateGoalInput {
  title?: string;
  targetValue?: number | null;
  targetUnit?: string | null;
  exerciseId?: string | null;
  startsAt?: Date;
  targetDate?: Date | null;
  status?: GoalStatus;
  completedAt?: Date | null;
}

export interface ListGoalsFilters {
  userId: string;
  status?: GoalStatus;
  type?: GoalType;
  limit: number;
  cursor?: string | null;
}

export interface ListGoalsResult {
  items: Goal[];
  nextCursor: string | null;
}

export interface GoalProgressMetrics {
  currentValue: number | null;
  baselineValue: number | null;
  unit: string | null;
}

/**
 * Port for goals + progress metric reads.
 */
export interface GoalRepository {
  create(input: CreateGoalInput): Promise<Goal>;
  findByIdForUser(id: string, userId: string): Promise<Goal | null>;
  list(filters: ListGoalsFilters): Promise<ListGoalsResult>;
  update(id: string, userId: string, input: UpdateGoalInput): Promise<Goal>;
  softDelete(id: string, userId: string): Promise<void>;
  exerciseExists(exerciseId: string): Promise<boolean>;
  listActiveByUser(userId: string): Promise<Goal[]>;
  strengthBestKg(userId: string, exerciseId: string): Promise<number | null>;
  latestBodyWeightKg(userId: string): Promise<number | null>;
  bodyWeightNear(
    userId: string,
    at: Date,
  ): Promise<number | null>;
  completedWorkoutCount(
    userId: string,
    from: Date,
    to?: Date | null,
  ): Promise<number>;
  totalVolumeKg(
    userId: string,
    from: Date,
    to?: Date | null,
  ): Promise<number>;
}
