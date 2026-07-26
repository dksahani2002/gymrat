import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Goal } from '../../../domain/goal/goal.entity';
import { GoalStatus, GoalType } from '../../../domain/goal/goal.enums';
import {
  CreateGoalInput,
  GoalRepository,
  ListGoalsFilters,
  ListGoalsResult,
  UpdateGoalInput,
} from '../../../domain/goal/repositories/goal.repository';
import {
  NotFoundError,
  RepositoryError,
} from '../../../shared/errors/base.error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoalPrismaRepository implements GoalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateGoalInput): Promise<Goal> {
    try {
      const row = await this.prisma.goal.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          targetValue:
            input.targetValue === undefined || input.targetValue === null
              ? null
              : new Prisma.Decimal(input.targetValue),
          targetUnit: input.targetUnit ?? null,
          exerciseId: input.exerciseId ?? null,
          startsAt: input.startsAt,
          targetDate: input.targetDate ?? null,
        },
        include: { exercise: { select: { name: true, slug: true } } },
      });
      return this.toDomain(row);
    } catch (error) {
      throw new RepositoryError('Failed to create goal', error);
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<Goal | null> {
    const row = await this.prisma.goal.findFirst({
      where: { id, userId, deletedAt: null },
      include: { exercise: { select: { name: true, slug: true } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filters: ListGoalsFilters): Promise<ListGoalsResult> {
    const where: Prisma.GoalWhereInput = {
      userId: filters.userId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    };

    if (filters.cursor) {
      const cursorRow = await this.prisma.goal.findFirst({
        where: { id: filters.cursor, userId: filters.userId },
      });
      if (cursorRow) {
        where.OR = [
          { createdAt: { lt: cursorRow.createdAt } },
          { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
        ];
      }
    }

    const rows = await this.prisma.goal.findMany({
      where,
      include: { exercise: { select: { name: true, slug: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filters.limit + 1,
    });

    const hasMore = rows.length > filters.limit;
    const page = hasMore ? rows.slice(0, filters.limit) : rows;
    return {
      items: page.map((row) => this.toDomain(row)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async update(
    id: string,
    userId: string,
    input: UpdateGoalInput,
  ): Promise<Goal> {
    const existing = await this.findByIdForUser(id, userId);
    if (!existing) {
      throw new NotFoundError('Goal not found');
    }

    const data: Prisma.GoalUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.targetValue !== undefined) {
      data.targetValue =
        input.targetValue === null
          ? null
          : new Prisma.Decimal(input.targetValue);
    }
    if (input.targetUnit !== undefined) data.targetUnit = input.targetUnit;
    if (input.exerciseId !== undefined) {
      data.exercise =
        input.exerciseId === null
          ? { disconnect: true }
          : { connect: { id: input.exerciseId } };
    }
    if (input.startsAt !== undefined) data.startsAt = input.startsAt;
    if (input.targetDate !== undefined) data.targetDate = input.targetDate;
    if (input.status !== undefined) data.status = input.status;
    if (input.completedAt !== undefined) data.completedAt = input.completedAt;

    const row = await this.prisma.goal.update({
      where: { id },
      data,
      include: { exercise: { select: { name: true, slug: true } } },
    });
    return this.toDomain(row);
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const result = await this.prisma.goal.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date(), status: GoalStatus.ABANDONED },
    });
    if (result.count === 0) {
      throw new NotFoundError('Goal not found');
    }
  }

  async exerciseExists(exerciseId: string): Promise<boolean> {
    const count = await this.prisma.exercise.count({
      where: { id: exerciseId, deletedAt: null },
    });
    return count > 0;
  }

  async listActiveByUser(userId: string): Promise<Goal[]> {
    const rows = await this.prisma.goal.findMany({
      where: { userId, deletedAt: null, status: GoalStatus.ACTIVE },
      include: { exercise: { select: { name: true, slug: true } } },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async strengthBestKg(
    userId: string,
    exerciseId: string,
  ): Promise<number | null> {
    const stat = await this.prisma.exerciseStat.findUnique({
      where: { userId_exerciseId: { userId, exerciseId } },
    });
    if (stat?.bestWeightKg) {
      return Number(stat.bestWeightKg);
    }
    const pr = await this.prisma.personalRecord.findFirst({
      where: { userId, exerciseId, type: 'MAX_WEIGHT' },
      orderBy: { value: 'desc' },
    });
    return pr ? Number(pr.value) : null;
  }

  async latestBodyWeightKg(userId: string): Promise<number | null> {
    const row = await this.prisma.bodyWeightEntry.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { recordedAt: 'desc' },
    });
    return row ? Number(row.weightKg) : null;
  }

  async bodyWeightNear(userId: string, at: Date): Promise<number | null> {
    const after = await this.prisma.bodyWeightEntry.findFirst({
      where: { userId, deletedAt: null, recordedAt: { gte: at } },
      orderBy: { recordedAt: 'asc' },
    });
    if (after) return Number(after.weightKg);

    const before = await this.prisma.bodyWeightEntry.findFirst({
      where: { userId, deletedAt: null, recordedAt: { lte: at } },
      orderBy: { recordedAt: 'desc' },
    });
    return before ? Number(before.weightKg) : null;
  }

  async completedWorkoutCount(
    userId: string,
    from: Date,
    to?: Date | null,
  ): Promise<number> {
    return this.prisma.workout.count({
      where: {
        userId,
        deletedAt: null,
        status: 'COMPLETED',
        completedAt: {
          gte: from,
          ...(to ? { lte: to } : {}),
        },
      },
    });
  }

  async totalVolumeKg(
    userId: string,
    from: Date,
    to?: Date | null,
  ): Promise<number> {
    const fromDate = new Date(
      from.toISOString().slice(0, 10) + 'T00:00:00.000Z',
    );
    const toDate = to
      ? new Date(to.toISOString().slice(0, 10) + 'T00:00:00.000Z')
      : undefined;

    const rows = await this.prisma.analyticsDailySnapshot.findMany({
      where: {
        userId,
        date: {
          gte: fromDate,
          ...(toDate ? { lte: toDate } : {}),
        },
      },
      select: { totalVolumeKg: true },
    });
    return rows.reduce((sum, row) => sum + Number(row.totalVolumeKg), 0);
  }

  private toDomain(row: {
    id: string;
    userId: string;
    type: string;
    title: string;
    targetValue: Prisma.Decimal | null;
    targetUnit: string | null;
    exerciseId: string | null;
    status: string;
    startsAt: Date;
    targetDate: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    exercise?: { name: string; slug: string } | null;
  }): Goal {
    return Goal.create({
      id: row.id,
      userId: row.userId,
      type: row.type as GoalType,
      title: row.title,
      targetValue: row.targetValue === null ? null : Number(row.targetValue),
      targetUnit: row.targetUnit,
      exerciseId: row.exerciseId,
      exerciseName: row.exercise?.name ?? null,
      exerciseSlug: row.exercise?.slug ?? null,
      status: row.status as GoalStatus,
      startsAt: row.startsAt,
      targetDate: row.targetDate,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
