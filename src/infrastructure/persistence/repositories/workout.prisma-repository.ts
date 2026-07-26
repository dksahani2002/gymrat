import { Injectable } from '@nestjs/common';
import {
  Prisma,
  WeightUnit as PrismaWeightUnit,
  WorkoutSource as PrismaSource,
  WorkoutStatus as PrismaStatus,
} from '@prisma/client';
import { Workout } from '../../../domain/workout/workout.entity';
import { WeightUnit } from '../../../domain/workout/workout.enums';
import {
  CreateWorkoutInput,
  ListWorkoutsFilters,
  ListWorkoutsResult,
  UpdateWorkoutMetaInput,
  WorkoutExerciseInput,
  WorkoutRepository,
  WorkoutSetInput,
} from '../../../domain/workout/repositories/workout.repository';
import { NotFoundError, RepositoryError } from '../../../shared/errors/base.error';
import { toWeightKg } from '../../../shared/utils/unit-conversion.utils';
import { PrismaService } from '../prisma/prisma.service';
import { WorkoutMapper } from '../prisma/mappers/workout.mapper';

const workoutInclude = {
  exercises: {
    include: {
      exercise: { select: { name: true, slug: true } },
      sets: true,
    },
  },
} satisfies Prisma.WorkoutInclude;

@Injectable()
export class WorkoutPrismaRepository implements WorkoutRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateWorkoutInput): Promise<Workout> {
    try {
      const row = await this.prisma.workout.create({
        data: {
          userId: input.userId,
          title: input.title ?? null,
          notes: input.notes ?? null,
          source: input.source as PrismaSource,
          status: (input.status ?? 'IN_PROGRESS') as PrismaStatus,
          startedAt: input.startedAt,
          completedAt: input.completedAt ?? null,
          durationSec: input.durationSec ?? null,
          exercises: {
            create: input.exercises.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              position: exercise.position,
              notes: exercise.notes ?? null,
              sets: {
                create: exercise.sets.map((set) => this.setCreateData(set)),
              },
            })),
          },
        },
        include: workoutInclude,
      });
      return WorkoutMapper.toDomain(row);
    } catch (error) {
      throw new RepositoryError('Failed to create workout', error);
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<Workout | null> {
    const row = await this.prisma.workout.findFirst({
      where: { id, userId, deletedAt: null },
      include: workoutInclude,
    });
    return row ? WorkoutMapper.toDomain(row) : null;
  }

  async list(filters: ListWorkoutsFilters): Promise<ListWorkoutsResult> {
    const where: Prisma.WorkoutWhereInput = {
      userId: filters.userId,
      deletedAt: null,
    };
    if (filters.status) {
      where.status = filters.status as PrismaStatus;
    }
    if (filters.from || filters.to) {
      where.startedAt = {};
      if (filters.from) where.startedAt.gte = filters.from;
      if (filters.to) where.startedAt.lte = filters.to;
    }
    if (filters.cursor) {
      const cursorRow = await this.prisma.workout.findUnique({
        where: { id: filters.cursor },
        select: { startedAt: true, id: true },
      });
      if (cursorRow) {
        where.AND = [
          {
            OR: [
              { startedAt: { lt: cursorRow.startedAt } },
              { startedAt: cursorRow.startedAt, id: { lt: cursorRow.id } },
            ],
          },
        ];
      }
    }

    const rows = await this.prisma.workout.findMany({
      where,
      include: workoutInclude,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: filters.limit + 1,
    });
    const page = rows.slice(0, filters.limit);
    return {
      items: page.map((row) => WorkoutMapper.toDomain(row)),
      nextCursor: rows.length > filters.limit ? page[page.length - 1]?.id ?? null : null,
    };
  }

  async updateMeta(
    id: string,
    userId: string,
    input: UpdateWorkoutMetaInput,
  ): Promise<Workout> {
    await this.ensureOwned(id, userId);
    const row = await this.prisma.workout.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
      },
      include: workoutInclude,
    });
    return WorkoutMapper.toDomain(row);
  }

  async replaceExercises(
    id: string,
    userId: string,
    exercises: WorkoutExerciseInput[],
  ): Promise<Workout> {
    await this.ensureOwned(id, userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.workoutExercise.deleteMany({ where: { workoutId: id } });
      for (const exercise of exercises) {
        await tx.workoutExercise.create({
          data: {
            workoutId: id,
            exerciseId: exercise.exerciseId,
            position: exercise.position,
            notes: exercise.notes ?? null,
            sets: {
              create: exercise.sets.map((set) => this.setCreateData(set)),
            },
          },
        });
      }
    });
    return (await this.findByIdForUser(id, userId))!;
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await this.ensureOwned(id, userId);
    await this.prisma.workout.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async complete(
    id: string,
    userId: string,
    completedAt: Date,
    durationSec: number,
  ): Promise<Workout> {
    await this.ensureOwned(id, userId);
    const row = await this.prisma.workout.update({
      where: { id },
      data: {
        status: PrismaStatus.COMPLETED,
        completedAt,
        durationSec,
      },
      include: workoutInclude,
    });
    return WorkoutMapper.toDomain(row);
  }

  async addExercise(
    workoutId: string,
    userId: string,
    input: WorkoutExerciseInput,
  ): Promise<Workout> {
    await this.ensureOwned(workoutId, userId);
    await this.prisma.workoutExercise.create({
      data: {
        workoutId,
        exerciseId: input.exerciseId,
        position: input.position,
        notes: input.notes ?? null,
        sets: {
          create: input.sets.map((set) => this.setCreateData(set)),
        },
      },
    });
    return (await this.findByIdForUser(workoutId, userId))!;
  }

  async updateExercise(
    workoutId: string,
    workoutExerciseId: string,
    userId: string,
    input: { position?: number; notes?: string | null },
  ): Promise<Workout> {
    await this.ensureOwned(workoutId, userId);
    const existing = await this.prisma.workoutExercise.findFirst({
      where: { id: workoutExerciseId, workoutId },
    });
    if (!existing) {
      throw new NotFoundError('Workout exercise not found');
    }
    await this.prisma.workoutExercise.update({
      where: { id: workoutExerciseId },
      data: {
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    return (await this.findByIdForUser(workoutId, userId))!;
  }

  async removeExercise(
    workoutId: string,
    workoutExerciseId: string,
    userId: string,
  ): Promise<Workout> {
    await this.ensureOwned(workoutId, userId);
    const existing = await this.prisma.workoutExercise.findFirst({
      where: { id: workoutExerciseId, workoutId },
    });
    if (!existing) {
      throw new NotFoundError('Workout exercise not found');
    }
    await this.prisma.workoutExercise.delete({ where: { id: workoutExerciseId } });
    return (await this.findByIdForUser(workoutId, userId))!;
  }

  async addSet(
    workoutId: string,
    workoutExerciseId: string,
    userId: string,
    input: WorkoutSetInput,
  ): Promise<Workout> {
    await this.ensureOwned(workoutId, userId);
    const exercise = await this.prisma.workoutExercise.findFirst({
      where: { id: workoutExerciseId, workoutId },
    });
    if (!exercise) {
      throw new NotFoundError('Workout exercise not found');
    }
    await this.prisma.workoutSet.create({
      data: {
        workoutExerciseId,
        ...this.setCreateData(input),
      },
    });
    return (await this.findByIdForUser(workoutId, userId))!;
  }

  async updateSet(
    workoutId: string,
    setId: string,
    userId: string,
    input: Partial<WorkoutSetInput>,
  ): Promise<Workout> {
    await this.ensureOwned(workoutId, userId);
    const set = await this.prisma.workoutSet.findFirst({
      where: { id: setId, workoutExercise: { workoutId } },
    });
    if (!set) {
      throw new NotFoundError('Set not found');
    }

    const weightUnit = (input.weightUnit ?? set.weightUnit) as WeightUnit;
    const weight =
      input.weight !== undefined
        ? input.weight
        : set.weight
          ? Number(set.weight)
          : null;

    await this.prisma.workoutSet.update({
      where: { id: setId },
      data: {
        ...(input.setNumber !== undefined ? { setNumber: input.setNumber } : {}),
        ...(input.reps !== undefined ? { reps: input.reps } : {}),
        ...(input.weight !== undefined ? { weight: input.weight } : {}),
        ...(input.weightUnit !== undefined
          ? { weightUnit: input.weightUnit as PrismaWeightUnit }
          : {}),
        weightKg:
          weight === null || weight === undefined
            ? null
            : toWeightKg(weight, weightUnit),
        ...(input.rpe !== undefined ? { rpe: input.rpe } : {}),
        ...(input.durationSec !== undefined ? { durationSec: input.durationSec } : {}),
        ...(input.distanceM !== undefined ? { distanceM: input.distanceM } : {}),
        ...(input.isWarmup !== undefined ? { isWarmup: input.isWarmup } : {}),
        ...(input.isFailure !== undefined ? { isFailure: input.isFailure } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    return (await this.findByIdForUser(workoutId, userId))!;
  }

  async removeSet(
    workoutId: string,
    setId: string,
    userId: string,
  ): Promise<Workout> {
    await this.ensureOwned(workoutId, userId);
    const set = await this.prisma.workoutSet.findFirst({
      where: { id: setId, workoutExercise: { workoutId } },
    });
    if (!set) {
      throw new NotFoundError('Set not found');
    }
    await this.prisma.workoutSet.delete({ where: { id: setId } });
    return (await this.findByIdForUser(workoutId, userId))!;
  }

  async findByIdempotencyKey(userId: string, key: string): Promise<Workout | null> {
    const record = await this.prisma.workoutIdempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (!record || record.expiresAt.getTime() < Date.now() || !record.workoutId) {
      return null;
    }
    return this.findByIdForUser(record.workoutId, userId);
  }

  async saveIdempotencyKey(
    userId: string,
    key: string,
    workoutId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.workoutIdempotencyKey.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, workoutId, expiresAt },
      update: { workoutId, expiresAt },
    });
  }

  async exerciseExists(exerciseId: string): Promise<boolean> {
    const count = await this.prisma.exercise.count({
      where: { id: exerciseId, deletedAt: null, isActive: true },
    });
    return count > 0;
  }

  private async ensureOwned(id: string, userId: string): Promise<void> {
    const count = await this.prisma.workout.count({
      where: { id, userId, deletedAt: null },
    });
    if (!count) {
      throw new NotFoundError('Workout not found');
    }
  }

  private setCreateData(set: WorkoutSetInput) {
    const unit = set.weightUnit ?? WeightUnit.KG;
    const weight = set.weight ?? null;
    return {
      setNumber: set.setNumber,
      reps: set.reps ?? null,
      weight,
      weightUnit: unit as PrismaWeightUnit,
      weightKg: weight === null ? null : toWeightKg(weight, unit),
      rpe: set.rpe ?? null,
      durationSec: set.durationSec ?? null,
      distanceM: set.distanceM ?? null,
      isWarmup: set.isWarmup ?? false,
      isFailure: set.isFailure ?? false,
      notes: set.notes ?? null,
    };
  }
}
