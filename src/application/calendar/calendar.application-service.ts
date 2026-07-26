import { Inject, Injectable } from '@nestjs/common';
import {
  addDaysKey,
  parseDateKey,
} from '../../domain/analytics/analytics.helpers';
import {
  CALENDAR_REPOSITORY,
  CalendarRepository,
} from '../../domain/calendar/repositories/calendar.repository';
import { PlannedWorkout } from '../../domain/calendar/planned-workout.entity';
import { AUDIT_LOG_PORT } from '../identity/ports/audit-log.port';
import type { AuditLogPort } from '../identity/ports/audit-log.port';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface PlannedWorkoutView {
  id: string;
  title: string | null;
  plannedDate: string;
  notes: string | null;
  createdAt: Date;
}

export interface CompletedWorkoutView {
  id: string;
  title: string | null;
  date: string;
  status: string;
  durationSec: number | null;
  startedAt: Date;
  completedAt: Date;
}

export interface CalendarDayView {
  date: string;
  completed: CompletedWorkoutView[];
  planned: PlannedWorkoutView[];
}

/**
 * Training calendar: completed workouts + planned markers.
 */
@Injectable()
export class CalendarApplicationService {
  constructor(
    @Inject(CALENDAR_REPOSITORY) private readonly calendar: CalendarRepository,
    @Inject(AUDIT_LOG_PORT) private readonly audit: AuditLogPort,
  ) {}

  async getRange(input: { userId: string; from: string; to: string }): Promise<{
    from: string;
    to: string;
    timezone: string;
    days: CalendarDayView[];
  }> {
    const from = this.normalizeDate(input.from);
    const to = this.normalizeDate(input.to);
    this.assertRange(from, to);

    const timeZone = await this.calendar.getUserTimezone(input.userId);
    const fromUtc = parseDateKey(addDaysKey(from, -1));
    const toUtc = parseDateKey(addDaysKey(to, 2));

    const [completed, planned] = await Promise.all([
      this.calendar.listCompletedInRange(
        input.userId,
        fromUtc,
        toUtc,
        timeZone,
      ),
      this.calendar.listPlannedInRange(input.userId, from, to),
    ]);

    const byDate = new Map<string, CalendarDayView>();
    const ensure = (date: string) => {
      let day = byDate.get(date);
      if (!day) {
        day = { date, completed: [], planned: [] };
        byDate.set(date, day);
      }
      return day;
    };

    for (const item of completed) {
      if (item.date < from || item.date > to) continue;
      ensure(item.date).completed.push({
        id: item.id,
        title: item.title,
        date: item.date,
        status: item.status,
        durationSec: item.durationSec,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
      });
    }

    for (const item of planned) {
      ensure(item.plannedDate).planned.push(this.toPlannedView(item));
    }

    const days = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return { from, to, timezone: timeZone, days };
  }

  async createPlanned(input: {
    userId: string;
    title?: string | null;
    plannedDate: string;
    notes?: string | null;
    context: RequestContext;
  }): Promise<PlannedWorkoutView> {
    const plannedDate = this.normalizeDate(input.plannedDate);
    const created = await this.calendar.createPlanned({
      userId: input.userId,
      title: input.title?.trim() || null,
      plannedDate,
      notes: input.notes?.trim() || null,
    });

    await this.audit.record({
      actorId: input.userId,
      action: 'calendar.planned.create',
      resourceType: 'planned_workout',
      resourceId: created.id,
      afterJson: this.toPlannedView(created),
      ip: input.context.ip,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });

    return this.toPlannedView(created);
  }

  async updatePlanned(input: {
    userId: string;
    id: string;
    title?: string | null;
    plannedDate?: string;
    notes?: string | null;
    context: RequestContext;
  }): Promise<PlannedWorkoutView> {
    const existing = await this.calendar.findPlannedByIdForUser(
      input.id,
      input.userId,
    );
    if (!existing) {
      throw new NotFoundError('Planned workout not found');
    }

    const updated = await this.calendar.updatePlanned(input.id, input.userId, {
      title:
        input.title === undefined ? undefined : input.title?.trim() || null,
      plannedDate: input.plannedDate
        ? this.normalizeDate(input.plannedDate)
        : undefined,
      notes:
        input.notes === undefined ? undefined : input.notes?.trim() || null,
    });

    await this.audit.record({
      actorId: input.userId,
      action: 'calendar.planned.update',
      resourceType: 'planned_workout',
      resourceId: input.id,
      beforeJson: this.toPlannedView(existing),
      afterJson: this.toPlannedView(updated),
      ip: input.context.ip,
      userAgent: input.context.userAgent,
      requestId: input.context.requestId,
    });

    return this.toPlannedView(updated);
  }

  async deletePlanned(
    userId: string,
    id: string,
    context: RequestContext,
  ): Promise<void> {
    const existing = await this.calendar.findPlannedByIdForUser(id, userId);
    if (!existing) {
      throw new NotFoundError('Planned workout not found');
    }

    await this.calendar.softDeletePlanned(id, userId);
    await this.audit.record({
      actorId: userId,
      action: 'calendar.planned.delete',
      resourceType: 'planned_workout',
      resourceId: id,
      beforeJson: this.toPlannedView(existing),
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  private normalizeDate(value: string): string {
    const key = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      throw new BusinessError(
        'Dates must be YYYY-MM-DD',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    const parsed = parseDateKey(key);
    if (Number.isNaN(parsed.getTime())) {
      throw new BusinessError('Invalid date', ErrorCodes.VALIDATION_ERROR, 400);
    }
    return key;
  }

  private assertRange(from: string, to: string): void {
    if (from > to) {
      throw new BusinessError(
        'from must be <= to',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    const span =
      (parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000;
    if (span > 93) {
      throw new BusinessError(
        'Calendar range cannot exceed 93 days',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private toPlannedView(item: PlannedWorkout): PlannedWorkoutView {
    return {
      id: item.id,
      title: item.title,
      plannedDate: item.plannedDate,
      notes: item.notes,
      createdAt: item.createdAt,
    };
  }
}
