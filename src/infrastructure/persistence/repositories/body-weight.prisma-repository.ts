import { Injectable } from '@nestjs/common';
import { Prisma, WeightUnit as PrismaWeightUnit } from '@prisma/client';
import {
  BodyWeightEntry,
  BodyWeightUnit,
} from '../../../domain/body-weight/body-weight-entry.entity';
import {
  BodyWeightRepository,
  CreateBodyWeightInput,
  ListBodyWeightFilters,
  ListBodyWeightResult,
} from '../../../domain/body-weight/repositories/body-weight.repository';
import { NotFoundError, RepositoryError } from '../../../shared/errors/base.error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BodyWeightPrismaRepository implements BodyWeightRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateBodyWeightInput): Promise<BodyWeightEntry> {
    try {
      const row = await this.prisma.bodyWeightEntry.create({
        data: {
          userId: input.userId,
          weight: new Prisma.Decimal(input.weight),
          unit: input.unit as PrismaWeightUnit,
          weightKg: new Prisma.Decimal(input.weightKg),
          recordedAt: input.recordedAt,
          notes: input.notes ?? null,
        },
      });
      return this.toDomain(row);
    } catch (error) {
      throw new RepositoryError('Failed to create body weight entry', error);
    }
  }

  async list(filters: ListBodyWeightFilters): Promise<ListBodyWeightResult> {
    const where: Prisma.BodyWeightEntryWhereInput = {
      userId: filters.userId,
      deletedAt: null,
      ...(filters.from || filters.to
        ? {
            recordedAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    if (filters.cursor) {
      const cursorRow = await this.prisma.bodyWeightEntry.findFirst({
        where: { id: filters.cursor, userId: filters.userId },
      });
      if (cursorRow) {
        where.OR = [
          { recordedAt: { lt: cursorRow.recordedAt } },
          {
            recordedAt: cursorRow.recordedAt,
            id: { lt: cursorRow.id },
          },
        ];
      }
    }

    const rows = await this.prisma.bodyWeightEntry.findMany({
      where,
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: filters.limit + 1,
    });

    const hasMore = rows.length > filters.limit;
    const page = hasMore ? rows.slice(0, filters.limit) : rows;
    return {
      items: page.map((row) => this.toDomain(row)),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<BodyWeightEntry | null> {
    const row = await this.prisma.bodyWeightEntry.findFirst({
      where: { id, userId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const result = await this.prisma.bodyWeightEntry.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundError('Body weight entry not found');
    }
  }

  async listInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<BodyWeightEntry[]> {
    const rows = await this.prisma.bodyWeightEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        recordedAt: { gte: from, lte: to },
      },
      orderBy: { recordedAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    userId: string;
    weight: Prisma.Decimal;
    unit: PrismaWeightUnit;
    weightKg: Prisma.Decimal;
    recordedAt: Date;
    notes: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  }): BodyWeightEntry {
    return BodyWeightEntry.create({
      id: row.id,
      userId: row.userId,
      weight: Number(row.weight),
      unit: row.unit as BodyWeightUnit,
      weightKg: Number(row.weightKg),
      recordedAt: row.recordedAt,
      notes: row.notes,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    });
  }
}
