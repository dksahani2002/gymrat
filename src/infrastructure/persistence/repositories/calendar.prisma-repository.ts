import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dateKeyInTimeZone } from '../../../domain/analytics/analytics.helpers';
import { PlannedWorkout } from '../../../domain/calendar/planned-workout.entity';
import {
  CalendarRepository,
  CompletedCalendarItem,
  CreatePlannedWorkoutInput,
  UpdatePlannedWorkoutInput,
} from '../../../domain/calendar/repositories/calendar.repository';
import {
  NotFoundError,
  RepositoryError,
} from '../../../shared/errors/base.error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarPrismaRepository implements CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserTimezone(userId: string): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone ?? 'UTC';
  }

  async listCompletedInRange(
    userId: string,
    fromUtc: Date,
    toUtc: Date,
    timeZone: string,
  ): Promise<CompletedCalendarItem[]> {
    const rows = await this.prisma.workout.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'COMPLETED',
        completedAt: { gte: fromUtc, lt: toUtc },
      },
      orderBy: { completedAt: 'asc' },
      select: {
        id: true,
        title: true,
        status: true,
        durationSec: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return rows
      .filter((row) => row.completedAt)
      .map((row) => ({
        id: row.id,
        title: row.title,
        date: dateKeyInTimeZone(row.completedAt!, timeZone),
        status: row.status,
        durationSec: row.durationSec,
        startedAt: row.startedAt,
        completedAt: row.completedAt!,
      }));
  }

  async listPlannedInRange(
    userId: string,
    from: string,
    to: string,
  ): Promise<PlannedWorkout[]> {
    const rows = await this.prisma.plannedWorkout.findMany({
      where: {
        userId,
        deletedAt: null,
        plannedDate: {
          gte: new Date(`${from}T00:00:00.000Z`),
          lte: new Date(`${to}T00:00:00.000Z`),
        },
      },
      orderBy: { plannedDate: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async createPlanned(
    input: CreatePlannedWorkoutInput,
  ): Promise<PlannedWorkout> {
    try {
      const row = await this.prisma.plannedWorkout.create({
        data: {
          userId: input.userId,
          title: input.title ?? null,
          plannedDate: new Date(`${input.plannedDate}T00:00:00.000Z`),
          notes: input.notes ?? null,
        },
      });
      return this.toDomain(row);
    } catch (error) {
      throw new RepositoryError('Failed to create planned workout', error);
    }
  }

  async findPlannedByIdForUser(
    id: string,
    userId: string,
  ): Promise<PlannedWorkout | null> {
    const row = await this.prisma.plannedWorkout.findFirst({
      where: { id, userId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async updatePlanned(
    id: string,
    userId: string,
    input: UpdatePlannedWorkoutInput,
  ): Promise<PlannedWorkout> {
    const existing = await this.findPlannedByIdForUser(id, userId);
    if (!existing) {
      throw new NotFoundError('Planned workout not found');
    }

    const data: Prisma.PlannedWorkoutUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.plannedDate !== undefined) {
      data.plannedDate = new Date(`${input.plannedDate}T00:00:00.000Z`);
    }

    const row = await this.prisma.plannedWorkout.update({
      where: { id },
      data,
    });
    return this.toDomain(row);
  }

  async softDeletePlanned(id: string, userId: string): Promise<void> {
    const result = await this.prisma.plannedWorkout.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundError('Planned workout not found');
    }
  }

  private toDomain(row: {
    id: string;
    userId: string;
    title: string | null;
    plannedDate: Date;
    notes: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  }): PlannedWorkout {
    return PlannedWorkout.create({
      id: row.id,
      userId: row.userId,
      title: row.title,
      plannedDate: row.plannedDate.toISOString().slice(0, 10),
      notes: row.notes,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    });
  }
}
