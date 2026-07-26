import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_PORT } from '../identity/ports/audit-log.port';
import type { AuditLogPort } from '../identity/ports/audit-log.port';
import {
  BodyWeightDeletedEvent,
  BodyWeightLoggedEvent,
} from '../../domain/body-weight/events/body-weight.events';
import { BodyWeightUnit } from '../../domain/body-weight/body-weight-entry.entity';
import {
  BODY_WEIGHT_REPOSITORY,
  BodyWeightRepository,
} from '../../domain/body-weight/repositories/body-weight.repository';
import { EVENT_BUS, EventBusPort } from '../../shared/events/event-bus.port';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';
import { toWeightKg } from '../../shared/utils/unit-conversion.utils';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface BodyWeightView {
  id: string;
  userId: string;
  weight: number;
  unit: BodyWeightUnit;
  weightKg: number;
  recordedAt: Date;
  notes: string | null;
  createdAt: Date;
}

/**
 * Body weight logging use cases.
 */
@Injectable()
export class BodyWeightApplicationService {
  constructor(
    @Inject(BODY_WEIGHT_REPOSITORY)
    private readonly entries: BodyWeightRepository,
    @Inject(AUDIT_LOG_PORT) private readonly audit: AuditLogPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async create(input: {
    userId: string;
    weight: number;
    unit?: BodyWeightUnit;
    recordedAt?: string;
    notes?: string | null;
    context: RequestContext;
  }): Promise<BodyWeightView> {
    this.assertWeight(input.weight);
    const unit = input.unit ?? 'KG';
    const recordedAt = input.recordedAt
      ? new Date(input.recordedAt)
      : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      throw new BusinessError(
        'Invalid recordedAt',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (recordedAt.getTime() > Date.now() + 60_000) {
      throw new BusinessError(
        'recordedAt cannot be in the future',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    const entry = await this.entries.create({
      userId: input.userId,
      weight: input.weight,
      unit,
      weightKg: toWeightKg(input.weight, unit),
      recordedAt,
      notes: input.notes?.trim() || null,
    });

    await this.events.publish(
      'body_weight.logged',
      new BodyWeightLoggedEvent(
        entry.id,
        entry.userId,
        entry.weightKg,
        entry.recordedAt,
      ),
    );

    await this.audit.record({
      actorId: input.userId,
      action: 'body_weight.create',
      resourceType: 'body_weight_entry',
      resourceId: entry.id,
      afterJson: this.toView(entry),
      ip: input.context.ip,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });

    return this.toView(entry);
  }

  async list(input: {
    userId: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string | null;
  }): Promise<{ items: BodyWeightView[]; nextCursor: string | null }> {
    const result = await this.entries.list({
      userId: input.userId,
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
      limit: Math.min(Math.max(input.limit ?? 30, 1), 100),
      cursor: input.cursor,
    });
    return {
      items: result.items.map((item) => this.toView(item)),
      nextCursor: result.nextCursor,
    };
  }

  async softDelete(
    userId: string,
    entryId: string,
    context: RequestContext,
  ): Promise<void> {
    const existing = await this.entries.findByIdForUser(entryId, userId);
    if (!existing) {
      throw new NotFoundError('Body weight entry not found');
    }

    await this.entries.softDelete(entryId, userId);
    await this.events.publish(
      'body_weight.deleted',
      new BodyWeightDeletedEvent(entryId, userId),
    );

    await this.audit.record({
      actorId: userId,
      action: 'body_weight.delete',
      resourceType: 'body_weight_entry',
      resourceId: entryId,
      beforeJson: this.toView(existing),
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  private assertWeight(weight: number): void {
    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
      throw new BusinessError(
        'weight must be between 0 and 500 (exclusive of 0)',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private toView(entry: {
    id: string;
    userId: string;
    weight: number;
    unit: BodyWeightUnit;
    weightKg: number;
    recordedAt: Date;
    notes: string | null;
    createdAt: Date;
  }): BodyWeightView {
    return {
      id: entry.id,
      userId: entry.userId,
      weight: entry.weight,
      unit: entry.unit,
      weightKg: entry.weightKg,
      recordedAt: entry.recordedAt,
      notes: entry.notes,
      createdAt: entry.createdAt,
    };
  }
}
