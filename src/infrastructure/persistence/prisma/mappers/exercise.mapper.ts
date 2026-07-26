import { MuscleRole as PrismaMuscleRole } from '@prisma/client';
import { Exercise } from '../../../../domain/exercise/exercise.entity';
import { MuscleRole } from '../../../../domain/exercise/exercise.enums';

type ExerciseRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  equipmentId: string | null;
  isCustom: boolean;
  createdById: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  category: { id: string; slug: string; name: string } | null;
  equipment: { id: string; slug: string; name: string } | null;
  aliases: Array<{ alias: string }>;
  muscles: Array<{
    role: PrismaMuscleRole;
    muscleGroup: { id: string; slug: string; name: string };
  }>;
};

export class ExerciseMapper {
  static toDomain(row: ExerciseRow): Exercise {
    return Exercise.create({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      categoryId: row.categoryId,
      categorySlug: row.category?.slug ?? null,
      categoryName: row.category?.name ?? null,
      equipmentId: row.equipmentId,
      equipmentSlug: row.equipment?.slug ?? null,
      equipmentName: row.equipment?.name ?? null,
      isCustom: row.isCustom,
      createdById: row.createdById,
      isActive: row.isActive,
      aliases: row.aliases.map((a) => a.alias),
      muscles: row.muscles.map((m) => ({
        muscleGroupId: m.muscleGroup.id,
        muscleGroupSlug: m.muscleGroup.slug,
        muscleGroupName: m.muscleGroup.name,
        role: m.role as MuscleRole,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
