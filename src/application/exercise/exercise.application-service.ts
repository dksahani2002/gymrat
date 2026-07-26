import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_PORT } from '../identity/ports/audit-log.port';
import type { AuditLogPort } from '../identity/ports/audit-log.port';
import { Exercise } from '../../domain/exercise/exercise.entity';
import { EXERCISE_REPOSITORY } from '../../domain/exercise/repositories/exercise.repository';
import type { ExerciseRepository } from '../../domain/exercise/repositories/exercise.repository';
import { Role } from '../../domain/identity/role.enum';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import type { EventBusPort } from '../../shared/events/event-bus.port';
import {
  AuthorizationError,
  BusinessError,
  ConflictError,
  NotFoundError,
} from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';
import { RedisService } from '../../infrastructure/cache/redis.module';
import {
  CreateExerciseCommand,
  DeleteExerciseCommand,
  ExerciseView,
  SearchExercisesQuery,
  UpdateExerciseCommand,
} from './commands/exercise.commands';

const CATALOG_VERSION_KEY = 'exercises:catalog:version';
const CACHE_TTL_SECONDS = 3600;

/**
 * Application service for the exercise catalog.
 */
@Injectable()
export class ExerciseApplicationService {
  constructor(
    @Inject(EXERCISE_REPOSITORY) private readonly exercises: ExerciseRepository,
    @Inject(AUDIT_LOG_PORT) private readonly audit: AuditLogPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    private readonly redis: RedisService,
  ) {}

  async search(query: SearchExercisesQuery): Promise<{
    items: ExerciseView[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const result = await this.exercises.search({
      q: query.q?.trim() || undefined,
      categoryId: query.categoryId,
      categorySlug: query.categorySlug,
      muscleGroupId: query.muscleGroupId,
      muscleGroupSlug: query.muscleGroupSlug,
      equipmentId: query.equipmentId,
      includeCustomForUserId: query.actorUserId,
      cursor: query.cursor,
      limit,
    });

    return {
      items: result.items.map((item) => this.toView(item)),
      nextCursor: result.nextCursor,
    };
  }

  async getById(id: string, actorUserId: string): Promise<ExerciseView> {
    const exercise = await this.exercises.findById(id);
    if (!exercise || exercise.deletedAt) {
      throw new NotFoundError('Exercise not found');
    }
    if (
      exercise.isCustom &&
      exercise.createdById !== actorUserId
    ) {
      throw new NotFoundError('Exercise not found');
    }
    return this.toView(exercise);
  }

  async listCategories(): Promise<Array<{ id: string; slug: string; name: string }>> {
    return this.cachedList('categories', () => this.exercises.listCategories());
  }

  async listMuscles(): Promise<
    Array<{ id: string; slug: string; name: string; parentId?: string | null }>
  > {
    return this.cachedList('muscles', () => this.exercises.listMuscleGroups());
  }

  async listEquipment(): Promise<Array<{ id: string; slug: string; name: string }>> {
    return this.cachedList('equipment', () => this.exercises.listEquipment());
  }

  async create(command: CreateExerciseCommand): Promise<ExerciseView> {
    const isAdmin = command.actorRole === Role.ADMIN;
    const asCustom = command.asCustom === true || !isAdmin;

    if (!asCustom && !isAdmin) {
      throw new AuthorizationError('Only admins can create global exercises');
    }

    await this.assertRefs(command.categoryId, command.equipmentId, command.muscles);

    const slug = this.slugify(command.name);
    const existing = await this.exercises.findBySlug(slug);
    if (existing && !existing.deletedAt) {
      throw new ConflictError('An exercise with this name already exists', ErrorCodes.CONFLICT);
    }

    const created = await this.exercises.create({
      name: command.name.trim(),
      slug,
      description: command.description?.trim() || null,
      categoryId: command.categoryId ?? null,
      equipmentId: command.equipmentId ?? null,
      isCustom: asCustom,
      createdById: asCustom ? command.actorUserId : null,
      aliases: this.normalizeAliases(command.aliases),
      muscles: command.muscles,
    });

    await this.bumpCatalogVersion();
    this.events.publish('exercise.created', { exerciseId: created.id });

    await this.audit.record({
      actorId: command.actorUserId,
      action: 'exercise.create',
      resourceType: 'exercise',
      resourceId: created.id,
      afterJson: this.toView(created),
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return this.toView(created);
  }

  async update(command: UpdateExerciseCommand): Promise<ExerciseView> {
    const existing = await this.exercises.findById(command.exerciseId);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Exercise not found');
    }

    const isAdmin = command.actorRole === Role.ADMIN;
    const isOwner = existing.isCustom && existing.createdById === command.actorUserId;
    if (!isAdmin && !isOwner) {
      throw new AuthorizationError('You cannot update this exercise');
    }

    await this.assertRefs(command.categoryId, command.equipmentId, command.muscles);

    if (command.name) {
      const slug = this.slugify(command.name);
      const clash = await this.exercises.findBySlug(slug);
      if (clash && clash.id !== existing.id && !clash.deletedAt) {
        throw new ConflictError('An exercise with this name already exists', ErrorCodes.CONFLICT);
      }
    }

    const updated = await this.exercises.update(command.exerciseId, {
      name: command.name?.trim(),
      description:
        command.description === undefined
          ? undefined
          : command.description?.trim() || null,
      categoryId: command.categoryId,
      equipmentId: command.equipmentId,
      isActive: command.isActive,
      aliases:
        command.aliases === undefined
          ? undefined
          : this.normalizeAliases(command.aliases),
      muscles: command.muscles,
    });

    await this.bumpCatalogVersion();
    this.events.publish('exercise.updated', { exerciseId: updated.id });

    await this.audit.record({
      actorId: command.actorUserId,
      action: 'exercise.update',
      resourceType: 'exercise',
      resourceId: updated.id,
      beforeJson: this.toView(existing),
      afterJson: this.toView(updated),
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return this.toView(updated);
  }

  async softDelete(command: DeleteExerciseCommand): Promise<void> {
    const existing = await this.exercises.findById(command.exerciseId);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Exercise not found');
    }

    const isAdmin = command.actorRole === Role.ADMIN;
    const isOwner = existing.isCustom && existing.createdById === command.actorUserId;
    if (!isAdmin && !isOwner) {
      throw new AuthorizationError('You cannot delete this exercise');
    }

    await this.exercises.softDelete(command.exerciseId);
    await this.bumpCatalogVersion();
    this.events.publish('exercise.deleted', { exerciseId: command.exerciseId });

    await this.audit.record({
      actorId: command.actorUserId,
      action: 'exercise.delete',
      resourceType: 'exercise',
      resourceId: command.exerciseId,
      beforeJson: this.toView(existing),
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });
  }

  private async assertRefs(
    categoryId?: string | null,
    equipmentId?: string | null,
    muscles?: Array<{ muscleGroupId: string }>,
  ): Promise<void> {
    if (categoryId) {
      const cats = await this.exercises.listCategories();
      if (!cats.some((c) => c.id === categoryId)) {
        throw new BusinessError('Invalid categoryId', ErrorCodes.VALIDATION_ERROR, 400);
      }
    }
    if (equipmentId) {
      const equipment = await this.exercises.listEquipment();
      if (!equipment.some((e) => e.id === equipmentId)) {
        throw new BusinessError('Invalid equipmentId', ErrorCodes.VALIDATION_ERROR, 400);
      }
    }
    if (muscles && muscles.length > 0) {
      const ids = [...new Set(muscles.map((m) => m.muscleGroupId))];
      const ok = await this.exercises.muscleGroupsExist(ids);
      if (!ok) {
        throw new BusinessError('Invalid muscleGroupId', ErrorCodes.VALIDATION_ERROR, 400);
      }
    }
  }

  private normalizeAliases(aliases?: string[]): string[] {
    if (!aliases) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const alias of aliases) {
      const normalized = alias.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  private slugify(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) {
      throw new BusinessError('Invalid exercise name', ErrorCodes.VALIDATION_ERROR, 400);
    }
    return slug;
  }

  private toView(exercise: Exercise): ExerciseView {
    return {
      id: exercise.id,
      slug: exercise.slug,
      name: exercise.name,
      description: exercise.description,
      category:
        exercise.categoryId && exercise.categorySlug && exercise.categoryName
          ? {
              id: exercise.categoryId,
              slug: exercise.categorySlug,
              name: exercise.categoryName,
            }
          : null,
      equipment:
        exercise.equipmentId && exercise.equipmentSlug && exercise.equipmentName
          ? {
              id: exercise.equipmentId,
              slug: exercise.equipmentSlug,
              name: exercise.equipmentName,
            }
          : null,
      isCustom: exercise.isCustom,
      createdById: exercise.createdById,
      isActive: exercise.isActive,
      aliases: exercise.aliases,
      muscles: exercise.muscles,
      createdAt: exercise.createdAt,
      updatedAt: exercise.updatedAt,
    };
  }

  private async cachedList<T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const version = (await this.redis.raw.get(CATALOG_VERSION_KEY)) ?? '0';
    const cacheKey = `exercises:catalog:${version}:${key}`;
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    const data = await loader();
    await this.redis.raw.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
    return data;
  }

  private async bumpCatalogVersion(): Promise<void> {
    await this.redis.raw.incr(CATALOG_VERSION_KEY);
  }
}
