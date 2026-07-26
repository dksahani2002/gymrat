import { Prisma, WeightUnit as PrismaWeightUnit } from '@prisma/client';
import { Workout } from '../../../../domain/workout/workout.entity';
import {
  WeightUnit,
  WorkoutSource,
  WorkoutStatus,
} from '../../../../domain/workout/workout.enums';

type WorkoutRow = {
  id: string;
  userId: string;
  title: string | null;
  notes: string | null;
  source: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  durationSec: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  exercises: Array<{
    id: string;
    exerciseId: string;
    position: number;
    notes: string | null;
    exercise: { name: string; slug: string };
    sets: Array<{
      id: string;
      setNumber: number;
      reps: number | null;
      weight: Prisma.Decimal | null;
      weightUnit: PrismaWeightUnit;
      weightKg: Prisma.Decimal | null;
      rpe: Prisma.Decimal | null;
      durationSec: number | null;
      distanceM: Prisma.Decimal | null;
      isWarmup: boolean;
      isFailure: boolean;
      notes: string | null;
    }>;
  }>;
};

export class WorkoutMapper {
  static toDomain(row: WorkoutRow): Workout {
    return Workout.create({
      id: row.id,
      userId: row.userId,
      title: row.title,
      notes: row.notes,
      source: row.source as WorkoutSource,
      status: row.status as WorkoutStatus,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationSec: row.durationSec,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      exercises: row.exercises
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((exercise) => ({
          id: exercise.id,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exercise.name,
          exerciseSlug: exercise.exercise.slug,
          position: exercise.position,
          notes: exercise.notes,
          sets: exercise.sets
            .slice()
            .sort((a, b) => a.setNumber - b.setNumber)
            .map((set) => ({
              id: set.id,
              setNumber: set.setNumber,
              reps: set.reps,
              weight: set.weight ? Number(set.weight) : null,
              weightUnit: set.weightUnit as WeightUnit,
              weightKg: set.weightKg ? Number(set.weightKg) : null,
              rpe: set.rpe ? Number(set.rpe) : null,
              durationSec: set.durationSec,
              distanceM: set.distanceM ? Number(set.distanceM) : null,
              isWarmup: set.isWarmup,
              isFailure: set.isFailure,
              notes: set.notes,
            })),
        })),
    });
  }
}
