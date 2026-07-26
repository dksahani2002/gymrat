import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BodyMeasurement,
  MeasurementMap,
} from '../../../domain/body-measurement/body-measurement.entity';
import {
  BodyMeasurementRepository,
  CreateBodyMeasurementInput,
  ListBodyMeasurementFilters,
  ListBodyMeasurementResult,
} from '../../../domain/body-measurement/repositories/body-measurement.repository';
import { NotFoundError, RepositoryError } from '../../../shared/errors/base.error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BodyMeasurementPrismaRepository
  implements BodyMeasurementRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateBodyMeasurementInput): Promise<BodyMeasurement> {
    try {
      const row = await this.prisma.bodyMeasurement.create({
        data: {
          userId: input.userId,
          measurements: input.measurements as Prisma.InputJsonValue,
          recordedAt: input.recordedAt,
          notes: input.notes ?? null,
        },
      });
      return this.toDomain(row);
    } catch (error) {
      throw new RepositoryError('Failed to create body measurement', error);
    }
  }

  async list(
    filters: ListBodyMeasurementFilters,
  ): Promise<ListBodyMeasurementResult> {
    const where: Prisma.BodyMeasurementWhereInput = {
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
      const cursorRow = await this.prisma.bodyMeasurement.findFirst({
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

    const rows = await this.prisma.bodyMeasurement.findMany({
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
  ): Promise<BodyMeasurement | null> {
    const row = await this.prisma.bodyMeasurement.findFirst({
      where: { id, userId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const result = await this.prisma.bodyMeasurement.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundError('Body measurement not found');
    }
  }

  private toDomain(row: {
    id: string;
    userId: string;
    measurements: Prisma.JsonValue;
    recordedAt: Date;
    notes: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  }): BodyMeasurement {
    return BodyMeasurement.create({
      id: row.id,
      userId: row.userId,
      measurements: this.parseMeasurements(row.measurements),
      recordedAt: row.recordedAt,
      notes: row.notes,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
    });
  }

  private parseMeasurements(value: Prisma.JsonValue): MeasurementMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const out: MeasurementMap = {};
    for (const [key, raw] of Object.entries(value)) {
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        out[key] = raw;
      }
    }
    return out;
  }
}
