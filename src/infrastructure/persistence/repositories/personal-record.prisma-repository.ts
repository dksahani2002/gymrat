import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PersonalRecord } from '../../../domain/personal-record/personal-record.entity';
import { PrType } from '../../../domain/personal-record/pr-type.enum';
import {
  CreatePersonalRecordInput,
  ListPersonalRecordsFilters,
  ListPersonalRecordsResult,
  PersonalRecordRepository,
} from '../../../domain/personal-record/repositories/personal-record.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PersonalRecordPrismaRepository implements PersonalRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(
    inputs: CreatePersonalRecordInput[],
  ): Promise<PersonalRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    const created: PersonalRecord[] = [];
    for (const input of inputs) {
      try {
        const row = await this.prisma.personalRecord.create({
          data: {
            userId: input.userId,
            exerciseId: input.exerciseId,
            type: input.type,
            value: new Prisma.Decimal(input.value),
            unit: input.unit ?? null,
            workoutId: input.workoutId ?? null,
            achievedAt: input.achievedAt,
          },
          include: {
            exercise: { select: { name: true, slug: true } },
          },
        });
        created.push(this.toDomain(row));
      } catch (error) {
        // Idempotent re-delivery of workout.completed for same workout+type
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    return created;
  }

  async list(
    filters: ListPersonalRecordsFilters,
  ): Promise<ListPersonalRecordsResult> {
    const where: Prisma.PersonalRecordWhereInput = {
      userId: filters.userId,
      ...(filters.exerciseId ? { exerciseId: filters.exerciseId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.from || filters.to
        ? {
            achievedAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    if (filters.cursor) {
      const cursorRow = await this.prisma.personalRecord.findFirst({
        where: { id: filters.cursor, userId: filters.userId },
      });
      if (cursorRow) {
        where.OR = [
          { achievedAt: { lt: cursorRow.achievedAt } },
          {
            achievedAt: cursorRow.achievedAt,
            id: { lt: cursorRow.id },
          },
        ];
      }
    }

    const rows = await this.prisma.personalRecord.findMany({
      where,
      include: { exercise: { select: { name: true, slug: true } } },
      orderBy: [{ achievedAt: 'desc' }, { id: 'desc' }],
      take: filters.limit + 1,
    });

    const hasMore = rows.length > filters.limit;
    const page = hasMore ? rows.slice(0, filters.limit) : rows;
    return {
      items: page.map((row) => this.toDomain(row)),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  }

  async findBests(
    userId: string,
    exerciseIds?: string[],
  ): Promise<PersonalRecord[]> {
    const where: Prisma.PersonalRecordWhereInput = {
      userId,
      ...(exerciseIds && exerciseIds.length > 0
        ? { exerciseId: { in: exerciseIds } }
        : {}),
    };

    const rows = await this.prisma.personalRecord.findMany({
      where,
      include: { exercise: { select: { name: true, slug: true } } },
      orderBy: [{ value: 'desc' }, { achievedAt: 'desc' }],
    });

    const bestByKey = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = `${row.exerciseId}:${row.type}`;
      if (!bestByKey.has(key)) {
        bestByKey.set(key, row);
      }
    }

    return [...bestByKey.values()].map((row) => this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    userId: string;
    exerciseId: string;
    type: string;
    value: Prisma.Decimal;
    unit: string | null;
    workoutId: string | null;
    achievedAt: Date;
    createdAt: Date;
    exercise?: { name: string; slug: string };
  }): PersonalRecord {
    return PersonalRecord.create({
      id: row.id,
      userId: row.userId,
      exerciseId: row.exerciseId,
      exerciseName: row.exercise?.name,
      exerciseSlug: row.exercise?.slug,
      type: row.type as PrType,
      value: Number(row.value),
      unit: row.unit,
      workoutId: row.workoutId,
      achievedAt: row.achievedAt,
      createdAt: row.createdAt,
    });
  }
}
