import { Injectable } from '@nestjs/common';
import { MuscleRole as PrismaMuscleRole, Prisma } from '@prisma/client';
import { Exercise, NamedSlugRef } from '../../../domain/exercise/exercise.entity';
import {
  CreateExerciseInput,
  ExerciseRepository,
  ExerciseSearchFilters,
  ExerciseSearchResult,
  UpdateExerciseInput,
} from '../../../domain/exercise/repositories/exercise.repository';
import { ConflictError, RepositoryError } from '../../../shared/errors/base.error';
import { ErrorCodes } from '../../../shared/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { ExerciseMapper } from '../prisma/mappers/exercise.mapper';

const exerciseInclude = {
  category: true,
  equipment: true,
  aliases: true,
  muscles: { include: { muscleGroup: true } },
} satisfies Prisma.ExerciseInclude;

@Injectable()
export class ExercisePrismaRepository implements ExerciseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(filters: ExerciseSearchFilters): Promise<ExerciseSearchResult> {
    const where: Prisma.ExerciseWhereInput = {
      deletedAt: null,
      isActive: true,
      AND: [
        {
          OR: [
            { isCustom: false },
            filters.includeCustomForUserId
              ? { isCustom: true, createdById: filters.includeCustomForUserId }
              : { id: '00000000-0000-0000-0000-000000000000' },
          ],
        },
      ],
    };

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    } else if (filters.categorySlug) {
      where.category = { slug: filters.categorySlug };
    }

    if (filters.equipmentId) {
      where.equipmentId = filters.equipmentId;
    }

    if (filters.muscleGroupId) {
      where.muscles = { some: { muscleGroupId: filters.muscleGroupId } };
    } else if (filters.muscleGroupSlug) {
      where.muscles = { some: { muscleGroup: { slug: filters.muscleGroupSlug } } };
    }

    if (filters.q) {
      const q = filters.q.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { aliases: { some: { alias: { contains: q.toLowerCase(), mode: 'insensitive' } } } },
            { slug: { contains: q.toLowerCase(), mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (filters.cursor) {
      const cursorRow = await this.prisma.exercise.findUnique({
        where: { id: filters.cursor },
        select: { name: true, id: true },
      });
      if (cursorRow) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            OR: [
              { name: { gt: cursorRow.name } },
              { name: cursorRow.name, id: { gt: cursorRow.id } },
            ],
          },
        ];
      }
    }

    const rows = await this.prisma.exercise.findMany({
      where,
      include: exerciseInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: filters.limit + 1,
    });

    const page = rows.slice(0, filters.limit);
    const nextCursor = rows.length > filters.limit ? page[page.length - 1]?.id ?? null : null;

    return {
      items: page.map((row) => ExerciseMapper.toDomain(row)),
      nextCursor,
    };
  }

  async findById(id: string): Promise<Exercise | null> {
    const row = await this.prisma.exercise.findFirst({
      where: { id },
      include: exerciseInclude,
    });
    return row ? ExerciseMapper.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Exercise | null> {
    const row = await this.prisma.exercise.findFirst({
      where: { slug },
      include: exerciseInclude,
    });
    return row ? ExerciseMapper.toDomain(row) : null;
  }

  async create(input: CreateExerciseInput): Promise<Exercise> {
    try {
      const row = await this.prisma.exercise.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.categoryId ?? null,
          equipmentId: input.equipmentId ?? null,
          isCustom: input.isCustom,
          createdById: input.createdById ?? null,
          aliases: input.aliases?.length
            ? { create: input.aliases.map((alias) => ({ alias })) }
            : undefined,
          muscles: input.muscles?.length
            ? {
                create: input.muscles.map((m) => ({
                  muscleGroupId: m.muscleGroupId,
                  role: m.role as PrismaMuscleRole,
                })),
              }
            : undefined,
        },
        include: exerciseInclude,
      });
      return ExerciseMapper.toDomain(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('Alias or slug already exists', ErrorCodes.CONFLICT);
      }
      throw new RepositoryError('Failed to create exercise', error);
    }
  }

  async update(id: string, input: UpdateExerciseInput): Promise<Exercise> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const data: Prisma.ExerciseUpdateInput = {};
        if (input.name !== undefined) {
          data.name = input.name;
          data.slug = input.name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        }
        if (input.description !== undefined) data.description = input.description;
        if (input.categoryId !== undefined) {
          data.category = input.categoryId
            ? { connect: { id: input.categoryId } }
            : { disconnect: true };
        }
        if (input.equipmentId !== undefined) {
          data.equipment = input.equipmentId
            ? { connect: { id: input.equipmentId } }
            : { disconnect: true };
        }
        if (input.isActive !== undefined) data.isActive = input.isActive;

        await tx.exercise.update({ where: { id }, data });

        if (input.aliases !== undefined) {
          await tx.exerciseAlias.deleteMany({ where: { exerciseId: id } });
          if (input.aliases.length > 0) {
            await tx.exerciseAlias.createMany({
              data: input.aliases.map((alias) => ({ exerciseId: id, alias })),
            });
          }
        }

        if (input.muscles !== undefined) {
          await tx.exerciseMuscle.deleteMany({ where: { exerciseId: id } });
          if (input.muscles.length > 0) {
            await tx.exerciseMuscle.createMany({
              data: input.muscles.map((m) => ({
                exerciseId: id,
                muscleGroupId: m.muscleGroupId,
                role: m.role as PrismaMuscleRole,
              })),
            });
          }
        }
      });

      const updated = await this.findById(id);
      if (!updated) {
        throw new RepositoryError('Exercise missing after update');
      }
      return updated;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof RepositoryError) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('Alias or slug already exists', ErrorCodes.CONFLICT);
      }
      throw new RepositoryError('Failed to update exercise', error);
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.exercise.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async listCategories(): Promise<NamedSlugRef[]> {
    const rows = await this.prisma.exerciseCategory.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name }));
  }

  async listMuscleGroups(): Promise<NamedSlugRef[]> {
    const rows = await this.prisma.muscleGroup.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      parentId: r.parentId,
    }));
  }

  async listEquipment(): Promise<NamedSlugRef[]> {
    const rows = await this.prisma.equipment.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name }));
  }

  async findCategoryIdBySlug(slug: string): Promise<string | null> {
    const row = await this.prisma.exerciseCategory.findUnique({ where: { slug } });
    return row?.id ?? null;
  }

  async findMuscleGroupIdBySlug(slug: string): Promise<string | null> {
    const row = await this.prisma.muscleGroup.findUnique({ where: { slug } });
    return row?.id ?? null;
  }

  async findEquipmentIdBySlug(slug: string): Promise<string | null> {
    const row = await this.prisma.equipment.findUnique({ where: { slug } });
    return row?.id ?? null;
  }

  async muscleGroupsExist(ids: string[]): Promise<boolean> {
    const count = await this.prisma.muscleGroup.count({
      where: { id: { in: ids } },
    });
    return count === ids.length;
  }
}
