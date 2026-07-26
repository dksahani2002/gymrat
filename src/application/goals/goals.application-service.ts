import { Inject, Injectable, Logger } from '@nestjs/common';
import { AUDIT_LOG_PORT } from '../identity/ports/audit-log.port';
import type { AuditLogPort } from '../identity/ports/audit-log.port';
import {
  GoalCompletedEvent,
  GoalCreatedEvent,
  GoalDeletedEvent,
} from '../../domain/goal/events/goal.events';
import { Goal } from '../../domain/goal/goal.entity';
import { GoalStatus, GoalType } from '../../domain/goal/goal.enums';
import { computeProgressPercent } from '../../domain/goal/goal-progress';
import {
  GOAL_REPOSITORY,
  GoalRepository,
} from '../../domain/goal/repositories/goal.repository';
import { EVENT_BUS, EventBusPort } from '../../shared/events/event-bus.port';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface GoalProgressView {
  currentValue: number | null;
  baselineValue: number | null;
  targetValue: number | null;
  unit: string | null;
  percent: number | null;
  achieved: boolean;
}

export interface GoalView {
  id: string;
  userId: string;
  type: GoalType;
  title: string;
  targetValue: number | null;
  targetUnit: string | null;
  exerciseId: string | null;
  exerciseName: string | null;
  exerciseSlug: string | null;
  status: GoalStatus;
  startsAt: Date;
  targetDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  progress: GoalProgressView;
}

/**
 * Goals CRUD + computed progress.
 */
@Injectable()
export class GoalsApplicationService {
  private readonly logger = new Logger(GoalsApplicationService.name);

  constructor(
    @Inject(GOAL_REPOSITORY) private readonly goals: GoalRepository,
    @Inject(AUDIT_LOG_PORT) private readonly audit: AuditLogPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async create(input: {
    userId: string;
    type: GoalType;
    title: string;
    targetValue?: number | null;
    targetUnit?: string | null;
    exerciseId?: string | null;
    startsAt?: string;
    targetDate?: string | null;
    context: RequestContext;
  }): Promise<GoalView> {
    this.assertTitle(input.title);
    this.assertTypeRequirements(input);

    if (input.exerciseId) {
      const exists = await this.goals.exerciseExists(input.exerciseId);
      if (!exists) {
        throw new NotFoundError('Exercise not found');
      }
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const targetDate = input.targetDate ? new Date(input.targetDate) : null;
    this.assertDates(startsAt, targetDate);

    const goal = await this.goals.create({
      userId: input.userId,
      type: input.type,
      title: input.title.trim(),
      targetValue: input.targetValue ?? null,
      targetUnit: input.targetUnit ?? this.defaultUnit(input.type),
      exerciseId: input.exerciseId ?? null,
      startsAt,
      targetDate,
    });

    await this.events.publish(
      'goal.created',
      new GoalCreatedEvent(goal.id, goal.userId, goal.type),
    );

    await this.audit.record({
      actorId: input.userId,
      action: 'goal.create',
      resourceType: 'goal',
      resourceId: goal.id,
      afterJson: { type: goal.type, title: goal.title },
      ip: input.context.ip,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });

    return this.toViewWithProgress(goal);
  }

  async list(input: {
    userId: string;
    status?: GoalStatus;
    type?: GoalType;
    limit?: number;
    cursor?: string | null;
  }): Promise<{ items: GoalView[]; nextCursor: string | null }> {
    const result = await this.goals.list({
      userId: input.userId,
      status: input.status,
      type: input.type,
      limit: Math.min(Math.max(input.limit ?? 20, 1), 100),
      cursor: input.cursor,
    });
    const items = await Promise.all(
      result.items.map((goal) => this.toViewWithProgress(goal)),
    );
    return { items, nextCursor: result.nextCursor };
  }

  async getById(userId: string, goalId: string): Promise<GoalView> {
    const goal = await this.requireOwned(goalId, userId);
    return this.toViewWithProgress(goal);
  }

  async update(input: {
    userId: string;
    goalId: string;
    title?: string;
    targetValue?: number | null;
    targetUnit?: string | null;
    exerciseId?: string | null;
    startsAt?: string;
    targetDate?: string | null;
    status?: GoalStatus;
    context: RequestContext;
  }): Promise<GoalView> {
    const existing = await this.requireOwned(input.goalId, input.userId);
    if (input.title !== undefined) this.assertTitle(input.title);
    if (input.exerciseId) {
      const exists = await this.goals.exerciseExists(input.exerciseId);
      if (!exists) throw new NotFoundError('Exercise not found');
    }

    const startsAt = input.startsAt
      ? new Date(input.startsAt)
      : existing.startsAt;
    const targetDate =
      input.targetDate === undefined
        ? existing.targetDate
        : input.targetDate
          ? new Date(input.targetDate)
          : null;
    this.assertDates(startsAt, targetDate);

    if (input.status === GoalStatus.COMPLETED && existing.status !== GoalStatus.COMPLETED) {
      return this.complete(input.userId, input.goalId, input.context);
    }

    const updated = await this.goals.update(input.goalId, input.userId, {
      title: input.title?.trim(),
      targetValue: input.targetValue,
      targetUnit: input.targetUnit,
      exerciseId: input.exerciseId,
      startsAt: input.startsAt ? startsAt : undefined,
      targetDate: input.targetDate === undefined ? undefined : targetDate,
      status: input.status,
      completedAt:
        input.status === GoalStatus.ABANDONED ? null : undefined,
    });

    await this.audit.record({
      actorId: input.userId,
      action: 'goal.update',
      resourceType: 'goal',
      resourceId: input.goalId,
      ip: input.context.ip,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });

    return this.toViewWithProgress(updated);
  }

  async complete(
    userId: string,
    goalId: string,
    context: RequestContext,
  ): Promise<GoalView> {
    const existing = await this.requireOwned(goalId, userId);
    if (existing.status === GoalStatus.COMPLETED) {
      return this.toViewWithProgress(existing);
    }

    const updated = await this.goals.update(goalId, userId, {
      status: GoalStatus.COMPLETED,
      completedAt: new Date(),
    });

    await this.events.publish(
      'goal.completed',
      new GoalCompletedEvent(updated.id, updated.userId, updated.type),
    );

    await this.audit.record({
      actorId: userId,
      action: 'goal.complete',
      resourceType: 'goal',
      resourceId: goalId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return this.toViewWithProgress(updated);
  }

  async softDelete(
    userId: string,
    goalId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.requireOwned(goalId, userId);
    await this.goals.softDelete(goalId, userId);
    await this.events.publish(
      'goal.deleted',
      new GoalDeletedEvent(goalId, userId),
    );
    await this.audit.record({
      actorId: userId,
      action: 'goal.delete',
      resourceType: 'goal',
      resourceId: goalId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  /**
   * Auto-complete active goals that have reached 100% progress.
   */
  async evaluateActiveGoals(userId: string): Promise<void> {
    const active = await this.goals.listActiveByUser(userId);
    for (const goal of active) {
      const progress = await this.computeProgress(goal);
      if (progress.achieved) {
        this.logger.log(`Auto-completing goal ${goal.id} for user ${userId}`);
        await this.goals.update(goal.id, userId, {
          status: GoalStatus.COMPLETED,
          completedAt: new Date(),
        });
        await this.events.publish(
          'goal.completed',
          new GoalCompletedEvent(goal.id, userId, goal.type),
        );
      }
    }
  }

  private async computeProgress(goal: Goal): Promise<GoalProgressView> {
    const target = goal.targetValue;
    let current: number | null = null;
    let baseline: number | null = null;
    let unit = goal.targetUnit;

    switch (goal.type) {
      case GoalType.STRENGTH: {
        unit = unit ?? 'KG';
        if (goal.exerciseId) {
          current = await this.goals.strengthBestKg(
            goal.userId,
            goal.exerciseId,
          );
        }
        baseline = 0;
        break;
      }
      case GoalType.BODY_WEIGHT: {
        unit = unit ?? 'KG';
        current = await this.goals.latestBodyWeightKg(goal.userId);
        baseline = await this.goals.bodyWeightNear(
          goal.userId,
          goal.startsAt,
        );
        break;
      }
      case GoalType.FREQUENCY: {
        unit = unit ?? 'workouts';
        current = await this.goals.completedWorkoutCount(
          goal.userId,
          goal.startsAt,
          goal.targetDate,
        );
        baseline = 0;
        break;
      }
      case GoalType.VOLUME: {
        unit = unit ?? 'KG';
        current = await this.goals.totalVolumeKg(
          goal.userId,
          goal.startsAt,
          goal.targetDate,
        );
        baseline = 0;
        break;
      }
      case GoalType.CUSTOM:
      default:
        current = null;
        baseline = null;
        break;
    }

    const percent =
      goal.status === GoalStatus.COMPLETED
        ? 1
        : computeProgressPercent({ baseline, current, target });

    return {
      currentValue: current === null ? null : Math.round(current * 100) / 100,
      baselineValue:
        baseline === null ? null : Math.round(baseline * 100) / 100,
      targetValue: target,
      unit,
      percent,
      achieved:
        goal.status === GoalStatus.COMPLETED ||
        (percent !== null && percent >= 1),
    };
  }

  private async toViewWithProgress(goal: Goal): Promise<GoalView> {
    const progress = await this.computeProgress(goal);
    return {
      id: goal.id,
      userId: goal.userId,
      type: goal.type,
      title: goal.title,
      targetValue: goal.targetValue,
      targetUnit: goal.targetUnit,
      exerciseId: goal.exerciseId,
      exerciseName: goal.exerciseName ?? null,
      exerciseSlug: goal.exerciseSlug ?? null,
      status: goal.status,
      startsAt: goal.startsAt,
      targetDate: goal.targetDate,
      completedAt: goal.completedAt,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      progress,
    };
  }

  private async requireOwned(goalId: string, userId: string): Promise<Goal> {
    const goal = await this.goals.findByIdForUser(goalId, userId);
    if (!goal) {
      throw new NotFoundError('Goal not found');
    }
    return goal;
  }

  private assertTitle(title: string): void {
    if (!title?.trim() || title.trim().length > 120) {
      throw new BusinessError(
        'title is required (max 120 chars)',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private assertTypeRequirements(input: {
    type: GoalType;
    targetValue?: number | null;
    exerciseId?: string | null;
  }): void {
    if (input.type === GoalType.STRENGTH && !input.exerciseId) {
      throw new BusinessError(
        'exerciseId is required for STRENGTH goals',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (
      input.type !== GoalType.CUSTOM &&
      (input.targetValue === undefined ||
        input.targetValue === null ||
        input.targetValue <= 0)
    ) {
      throw new BusinessError(
        'targetValue must be a positive number for this goal type',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private assertDates(startsAt: Date, targetDate: Date | null): void {
    if (Number.isNaN(startsAt.getTime())) {
      throw new BusinessError(
        'Invalid startsAt',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (targetDate && Number.isNaN(targetDate.getTime())) {
      throw new BusinessError(
        'Invalid targetDate',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (targetDate && targetDate < startsAt) {
      throw new BusinessError(
        'targetDate must be on or after startsAt',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private defaultUnit(type: GoalType): string | null {
    switch (type) {
      case GoalType.STRENGTH:
      case GoalType.BODY_WEIGHT:
      case GoalType.VOLUME:
        return 'KG';
      case GoalType.FREQUENCY:
        return 'workouts';
      default:
        return null;
    }
  }
}
