import { Exercise, NamedSlugRef } from '../exercise.entity';
import { MuscleRole } from '../exercise.enums';

export const EXERCISE_REPOSITORY = Symbol('EXERCISE_REPOSITORY');

export interface ExerciseSearchFilters {
  q?: string;
  categoryId?: string;
  categorySlug?: string;
  muscleGroupId?: string;
  muscleGroupSlug?: string;
  equipmentId?: string;
  includeCustomForUserId?: string | null;
  cursor?: string | null;
  limit: number;
}

export interface ExerciseSearchResult {
  items: Exercise[];
  nextCursor: string | null;
}

export interface CreateExerciseInput {
  name: string;
  slug: string;
  description?: string | null;
  categoryId?: string | null;
  equipmentId?: string | null;
  isCustom: boolean;
  createdById?: string | null;
  aliases?: string[];
  muscles?: Array<{ muscleGroupId: string; role: MuscleRole }>;
}

export interface UpdateExerciseInput {
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  equipmentId?: string | null;
  isActive?: boolean;
  aliases?: string[];
  muscles?: Array<{ muscleGroupId: string; role: MuscleRole }>;
}

/**
 * Port for exercise catalog persistence and search.
 */
export interface ExerciseRepository {
  search(filters: ExerciseSearchFilters): Promise<ExerciseSearchResult>;
  findById(id: string): Promise<Exercise | null>;
  findBySlug(slug: string): Promise<Exercise | null>;
  create(input: CreateExerciseInput): Promise<Exercise>;
  update(id: string, input: UpdateExerciseInput): Promise<Exercise>;
  softDelete(id: string): Promise<void>;
  listCategories(): Promise<NamedSlugRef[]>;
  listMuscleGroups(): Promise<NamedSlugRef[]>;
  listEquipment(): Promise<NamedSlugRef[]>;
  findCategoryIdBySlug(slug: string): Promise<string | null>;
  findMuscleGroupIdBySlug(slug: string): Promise<string | null>;
  findEquipmentIdBySlug(slug: string): Promise<string | null>;
  muscleGroupsExist(ids: string[]): Promise<boolean>;
}
