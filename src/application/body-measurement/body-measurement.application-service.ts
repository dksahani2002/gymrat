import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_PORT } from '../identity/ports/audit-log.port';
import type { AuditLogPort } from '../identity/ports/audit-log.port';
import {
  BodyMeasurementDeletedEvent,
  BodyMeasurementLoggedEvent,
} from '../../domain/body-measurement/events/body-measurement.events';
import { MeasurementMap } from '../../domain/body-measurement/body-measurement.entity';
import {
  BODY_MEASUREMENT_REPOSITORY,
  BodyMeasurementRepository,
} from '../../domain/body-measurement/repositories/body-measurement.repository';
import { EVENT_BUS, EventBusPort } from '../../shared/events/event-bus.port';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface BodyMeasurementView {
  id: string;
  userId: string;
  measurements: MeasurementMap;
  unit: 'CM';
  recordedAt: Date;
  notes: string | null;
  createdAt: Date;
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

/**
 * Body circumference measurement use cases (values in cm).
 */
@Injectable()
export class BodyMeasurementApplicationService {
  constructor(
    @Inject(BODY_MEASUREMENT_REPOSITORY)
    private readonly entries: BodyMeasurementRepository,
    @Inject(AUDIT_LOG_PORT) private readonly audit: AuditLogPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async create(input: {
    userId: string;
    measurements: MeasurementMap;
    recordedAt?: string;
    notes?: string | null;
    context: RequestContext;
  }): Promise<BodyMeasurementView> {
    const measurements = this.normalizeMeasurements(input.measurements);
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
      measurements,
      recordedAt,
      notes: input.notes?.trim() || null,
    });

    await this.events.publish(
      'body_measurement.logged',
      new BodyMeasurementLoggedEvent(
        entry.id,
        entry.userId,
        entry.recordedAt,
      ),
    );

    await this.audit.record({
      actorId: input.userId,
      action: 'body_measurement.create',
      resourceType: 'body_measurement',
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
  }): Promise<{ items: BodyMeasurementView[]; nextCursor: string | null }> {
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
      throw new NotFoundError('Body measurement not found');
    }

    await this.entries.softDelete(entryId, userId);
    await this.events.publish(
      'body_measurement.deleted',
      new BodyMeasurementDeletedEvent(entryId, userId),
    );

    await this.audit.record({
      actorId: userId,
      action: 'body_measurement.delete',
      resourceType: 'body_measurement',
      resourceId: entryId,
      beforeJson: this.toView(existing),
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  private normalizeMeasurements(raw: MeasurementMap): MeasurementMap {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BusinessError(
        'measurements must be an object of key → cm values',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    const entries = Object.entries(raw);
    if (entries.length === 0) {
      throw new BusinessError(
        'At least one measurement is required',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (entries.length > 30) {
      throw new BusinessError(
        'Too many measurement keys (max 30)',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    const out: MeasurementMap = {};
    for (const [key, value] of entries) {
      if (!KEY_PATTERN.test(key)) {
        throw new BusinessError(
          `Invalid measurement key "${key}". Use snake_case (e.g. left_arm).`,
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BusinessError(
          `Measurement "${key}" must be a number (cm)`,
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
      }
      if (value < 1 || value > 300) {
        throw new BusinessError(
          `Measurement "${key}" must be between 1 and 300 cm`,
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
      }
      out[key] = Math.round(value * 100) / 100;
    }
    return out;
  }

  private toView(entry: {
    id: string;
    userId: string;
    measurements: MeasurementMap;
    recordedAt: Date;
    notes: string | null;
    createdAt: Date;
  }): BodyMeasurementView {
    return {
      id: entry.id,
      userId: entry.userId,
      measurements: entry.measurements,
      unit: 'CM',
      recordedAt: entry.recordedAt,
      notes: entry.notes,
      createdAt: entry.createdAt,
    };
  }
}
