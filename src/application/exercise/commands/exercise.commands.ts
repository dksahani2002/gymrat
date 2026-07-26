import { MuscleRole } from '../../../domain/exercise/exercise.enums';

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface ExerciseMuscleView {
  muscleGroupId: string;
  muscleGroupSlug: string;
  muscleGroupName: string;
  role: MuscleRole;
}

export interface ExerciseView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: { id: string; slug: string; name: string } | null;
  equipment: { id: string; slug: string; name: string } | null;
  isCustom: boolean;
  createdById: string | null;
  isActive: boolean;
  aliases: string[];
  muscles: ExerciseMuscleView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchExercisesQuery {
  q?: string;
  categoryId?: string;
  categorySlug?: string;
  muscleGroupId?: string;
  muscleGroupSlug?: string;
  equipmentId?: string;
  cursor?: string;
  limit?: number;
  actorUserId: string;
}

export interface CreateExerciseCommand {
  actorUserId: string;
  actorRole: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  equipmentId?: string | null;
  aliases?: string[];
  muscles?: Array<{ muscleGroupId: string; role: MuscleRole }>;
  /** When true (or non-admin), creates a user-owned custom exercise */
  asCustom?: boolean;
  context: RequestContext;
}

export interface UpdateExerciseCommand {
  actorUserId: string;
  actorRole: string;
  exerciseId: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  equipmentId?: string | null;
  isActive?: boolean;
  aliases?: string[];
  muscles?: Array<{ muscleGroupId: string; role: MuscleRole }>;
  context: RequestContext;
}

export interface DeleteExerciseCommand {
  actorUserId: string;
  actorRole: string;
  exerciseId: string;
  context: RequestContext;
}
