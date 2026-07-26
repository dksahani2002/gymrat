import { Injectable } from '@nestjs/common';
import {
  OverloadExerciseMeta,
  OverloadRepository,
  OverloadUserContext,
} from '../../../domain/progressive-overload/repositories/overload.repository';
import {
  OverloadGoal,
  OverloadSession,
} from '../../../domain/progressive-overload/overload.algorithm';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OverloadPrismaRepository implements OverloadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserContext(userId: string): Promise<OverloadUserContext> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { fitnessGoal: true, preferredWeightUnit: true },
    });
    return {
      fitnessGoal: (profile?.fitnessGoal as OverloadGoal | null) ?? null,
      preferredWeightUnit: (profile?.preferredWeightUnit as 'KG' | 'LB') ?? 'KG',
    };
  }

  async listRecentExerciseIds(
    userId: string,
    withinDays: number,
  ): Promise<string[]> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - withinDays);

    const rows = await this.prisma.workoutExercise.findMany({
      where: {
        workout: {
          userId,
          deletedAt: null,
          status: 'COMPLETED',
          completedAt: { gte: since },
        },
      },
      select: { exerciseId: true },
    });
    return [...new Set(rows.map((row) => row.exerciseId))];
  }

  async getExerciseMeta(
    exerciseId: string,
  ): Promise<OverloadExerciseMeta | null> {
    const row = await this.prisma.exercise.findFirst({
      where: { id: exerciseId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        equipment: { select: { slug: true } },
      },
    });
    if (!row) return null;
    return {
      exerciseId: row.id,
      name: row.name,
      slug: row.slug,
      equipmentSlug: row.equipment?.slug ?? null,
    };
  }

  async getRecentSessions(
    userId: string,
    exerciseId: string,
    limit: number,
  ): Promise<OverloadSession[]> {
    const workouts = await this.prisma.workout.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'COMPLETED',
        completedAt: { not: null },
        exercises: { some: { exerciseId } },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        exercises: {
          where: { exerciseId },
          include: { sets: { orderBy: { setNumber: 'asc' } } },
        },
      },
    });

    return workouts.map((workout) => ({
      performedAt: workout.completedAt!,
      sets: workout.exercises.flatMap((exercise) =>
        exercise.sets.map((set) => ({
          weightKg: set.weightKg ? Number(set.weightKg) : null,
          reps: set.reps,
          rpe: set.rpe ? Number(set.rpe) : null,
          isWarmup: set.isWarmup,
          isFailure: set.isFailure,
        })),
      ),
    }));
  }
}
