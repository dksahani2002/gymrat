import { Entity } from '../common/entity.base';
import { MuscleRole } from './exercise.enums';

export interface ExerciseMuscleRef {
  muscleGroupId: string;
  muscleGroupSlug: string;
  muscleGroupName: string;
  role: MuscleRole;
}

export interface ExerciseProps {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  equipmentId: string | null;
  equipmentSlug: string | null;
  equipmentName: string | null;
  isCustom: boolean;
  createdById: string | null;
  isActive: boolean;
  aliases: string[];
  muscles: ExerciseMuscleRef[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Canonical exercise catalog entry.
 */
export class Exercise extends Entity {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly categoryId: string | null;
  readonly categorySlug: string | null;
  readonly categoryName: string | null;
  readonly equipmentId: string | null;
  readonly equipmentSlug: string | null;
  readonly equipmentName: string | null;
  readonly isCustom: boolean;
  readonly createdById: string | null;
  readonly isActive: boolean;
  readonly aliases: string[];
  readonly muscles: ExerciseMuscleRef[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: ExerciseProps) {
    super(props.id);
    this.slug = props.slug;
    this.name = props.name;
    this.description = props.description;
    this.categoryId = props.categoryId;
    this.categorySlug = props.categorySlug;
    this.categoryName = props.categoryName;
    this.equipmentId = props.equipmentId;
    this.equipmentSlug = props.equipmentSlug;
    this.equipmentName = props.equipmentName;
    this.isCustom = props.isCustom;
    this.createdById = props.createdById;
    this.isActive = props.isActive;
    this.aliases = props.aliases;
    this.muscles = props.muscles;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: ExerciseProps): Exercise {
    return new Exercise(props);
  }
}

export interface NamedSlugRef {
  id: string;
  slug: string;
  name: string;
  parentId?: string | null;
}
