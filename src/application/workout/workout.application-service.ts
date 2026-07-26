import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_PORT } from '../identity/ports/audit-log.port';
import type { AuditLogPort } from '../identity/ports/audit-log.port';
import { Workout } from '../../domain/workout/workout.entity';
import {
  WorkoutSource,
  WorkoutStatus,
} from '../../domain/workout/workout.enums';
import {
  WorkoutCompletedEvent,
  WorkoutDeletedEvent,
} from '../../domain/workout/events/workout.events';
import { WORKOUT_REPOSITORY } from '../../domain/workout/repositories/workout.repository';
import type {
  WorkoutExerciseInput,
  WorkoutRepository,
  WorkoutSetInput,
} from '../../domain/workout/repositories/workout.repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import type { EventBusPort } from '../../shared/events/event-bus.port';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';
import {
  CreateWorkoutCommand,
  ListWorkoutsQuery,
  RequestContext,
  UpdateWorkoutCommand,
  WorkoutExerciseCommandInput,
  WorkoutSetCommandInput,
  WorkoutView,
} from './commands/workout.commands';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Application service for workout session CRUD and completion.
 */
@Injectable()
export class WorkoutApplicationService {
  constructor(
    @Inject(WORKOUT_REPOSITORY) private readonly workouts: WorkoutRepository,
    @Inject(AUDIT_LOG_PORT) private readonly audit: AuditLogPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async create(command: CreateWorkoutCommand): Promise<WorkoutView> {
    if (command.idempotencyKey) {
      const existing = await this.workouts.findByIdempotencyKey(
        command.userId,
        command.idempotencyKey,
      );
      if (existing) {
        return this.toView(existing);
      }
    }

    this.assertExercises(command.exercises);
    await this.assertExerciseIdsExist(command.exercises);

    const startedAt = command.startedAt
      ? new Date(command.startedAt)
      : new Date();
    if (Number.isNaN(startedAt.getTime())) {
      throw new BusinessError(
        'Invalid startedAt',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    const shouldComplete = command.completed === true;
    if (shouldComplete) {
      this.assertCompletable(command.exercises);
    }

    const completedAt = shouldComplete ? new Date() : null;
    const durationSec = shouldComplete
      ? Math.max(
          0,
          Math.floor((completedAt!.getTime() - startedAt.getTime()) / 1000),
        )
      : null;

    const workout = await this.workouts.create({
      userId: command.userId,
      title: command.title?.trim() || null,
      notes: command.notes?.trim() || null,
      source: command.source ?? WorkoutSource.MANUAL,
      status: shouldComplete
        ? WorkoutStatus.COMPLETED
        : WorkoutStatus.IN_PROGRESS,
      startedAt,
      completedAt,
      durationSec,
      exercises: this.toRepoExercises(command.exercises),
    });

    if (command.idempotencyKey) {
      await this.workouts.saveIdempotencyKey(
        command.userId,
        command.idempotencyKey,
        workout.id,
        new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      );
    }

    if (shouldComplete) {
      await this.emitCompleted(workout);
    }

    await this.audit.record({
      actorId: command.userId,
      action: 'workout.create',
      resourceType: 'workout',
      resourceId: workout.id,
      afterJson: {
        status: workout.status,
        exerciseCount: workout.exercises.length,
      },
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return this.toView(workout);
  }

  async list(query: ListWorkoutsQuery): Promise<{
    items: WorkoutView[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const result = await this.workouts.list({
      userId: query.userId,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      cursor: query.cursor,
      limit,
    });
    return {
      items: result.items.map((item) => this.toView(item)),
      nextCursor: result.nextCursor,
    };
  }

  async getById(userId: string, workoutId: string): Promise<WorkoutView> {
    const workout = await this.requireOwned(workoutId, userId);
    return this.toView(workout);
  }

  async update(command: UpdateWorkoutCommand): Promise<WorkoutView> {
    await this.requireOwned(command.workoutId, command.userId);

    let workout = await this.workouts.updateMeta(
      command.workoutId,
      command.userId,
      {
        title:
          command.title === undefined
            ? undefined
            : command.title?.trim() || null,
        notes:
          command.notes === undefined
            ? undefined
            : command.notes?.trim() || null,
        startedAt: command.startedAt ? new Date(command.startedAt) : undefined,
      },
    );

    if (command.exercises) {
      this.assertExercises(command.exercises);
      await this.assertExerciseIdsExist(command.exercises);
      workout = await this.workouts.replaceExercises(
        command.workoutId,
        command.userId,
        this.toRepoExercises(command.exercises),
      );
    }

    await this.audit.record({
      actorId: command.userId,
      action: 'workout.update',
      resourceType: 'workout',
      resourceId: command.workoutId,
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return this.toView(workout);
  }

  async softDelete(
    userId: string,
    workoutId: string,
    context: RequestContext,
  ): Promise<void> {
    const existing = await this.requireOwned(workoutId, userId);
    await this.workouts.softDelete(workoutId, userId);
    const event = new WorkoutDeletedEvent(
      workoutId,
      userId,
      existing.startedAt,
      existing.completedAt,
    );
    await this.events.publish(event.eventName, event);
    await this.audit.record({
      actorId: userId,
      action: 'workout.delete',
      resourceType: 'workout',
      resourceId: workoutId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
  }

  async complete(
    userId: string,
    workoutId: string,
    context: RequestContext,
  ): Promise<WorkoutView> {
    const existing = await this.requireOwned(workoutId, userId);
    if (existing.status === WorkoutStatus.COMPLETED) {
      return this.toView(existing);
    }
    if (existing.workingSetCount === 0) {
      throw new BusinessError(
        'Cannot complete a workout with no working sets',
        ErrorCodes.BUSINESS_ERROR,
      );
    }

    const completedAt = new Date();
    const durationSec = Math.max(
      0,
      Math.floor((completedAt.getTime() - existing.startedAt.getTime()) / 1000),
    );
    const workout = await this.workouts.complete(
      workoutId,
      userId,
      completedAt,
      durationSec,
    );
    await this.emitCompleted(workout);

    await this.audit.record({
      actorId: userId,
      action: 'workout.complete',
      resourceType: 'workout',
      resourceId: workoutId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return this.toView(workout);
  }

  async addExercise(
    userId: string,
    workoutId: string,
    input: WorkoutExerciseCommandInput,
    context: RequestContext,
  ): Promise<WorkoutView> {
    await this.requireOwned(workoutId, userId);
    this.assertExercises([input]);
    await this.assertExerciseIdsExist([input]);
    const workout = await this.workouts.addExercise(
      workoutId,
      userId,
      this.toRepoExercises([input])[0],
    );
    await this.audit.record({
      actorId: userId,
      action: 'workout.exercise_add',
      resourceType: 'workout',
      resourceId: workoutId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
    return this.toView(workout);
  }

  async updateExercise(
    userId: string,
    workoutId: string,
    workoutExerciseId: string,
    input: { position?: number; notes?: string | null },
    context: RequestContext,
  ): Promise<WorkoutView> {
    await this.requireOwned(workoutId, userId);
    const workout = await this.workouts.updateExercise(
      workoutId,
      workoutExerciseId,
      userId,
      input,
    );
    await this.audit.record({
      actorId: userId,
      action: 'workout.exercise_update',
      resourceType: 'workout',
      resourceId: workoutId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
    return this.toView(workout);
  }

  async removeExercise(
    userId: string,
    workoutId: string,
    workoutExerciseId: string,
    context: RequestContext,
  ): Promise<WorkoutView> {
    await this.requireOwned(workoutId, userId);
    const workout = await this.workouts.removeExercise(
      workoutId,
      workoutExerciseId,
      userId,
    );
    await this.audit.record({
      actorId: userId,
      action: 'workout.exercise_remove',
      resourceType: 'workout',
      resourceId: workoutId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
    return this.toView(workout);
  }

  async addSet(
    userId: string,
    workoutId: string,
    workoutExerciseId: string,
    input: WorkoutSetCommandInput,
    context: RequestContext,
  ): Promise<WorkoutView> {
    await this.requireOwned(workoutId, userId);
    this.assertSets([input]);
    const workout = await this.workouts.addSet(
      workoutId,
      workoutExerciseId,
      userId,
      this.toRepoSet(input),
    );
    await this.audit.record({
      actorId: userId,
      action: 'workout.set_add',
      resourceType: 'workout',
      resourceId: workoutId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
    return this.toView(workout);
  }

  async updateSet(
    userId: string,
    workoutId: string,
    setId: string,
    input: Partial<WorkoutSetCommandInput>,
    context: RequestContext,
  ): Promise<WorkoutView> {
    await this.requireOwned(workoutId, userId);
    const workout = await this.workouts.updateSet(
      workoutId,
      setId,
      userId,
      input,
    );
    await this.audit.record({
      actorId: userId,
      action: 'workout.set_update',
      resourceType: 'workout',
      resourceId: workoutId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
    return this.toView(workout);
  }

  async removeSet(
    userId: string,
    workoutId: string,
    setId: string,
    context: RequestContext,
  ): Promise<WorkoutView> {
    await this.requireOwned(workoutId, userId);
    const workout = await this.workouts.removeSet(workoutId, setId, userId);
    await this.audit.record({
      actorId: userId,
      action: 'workout.set_remove',
      resourceType: 'workout',
      resourceId: workoutId,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
    return this.toView(workout);
  }

  private async requireOwned(
    workoutId: string,
    userId: string,
  ): Promise<Workout> {
    const workout = await this.workouts.findByIdForUser(workoutId, userId);
    if (!workout || workout.deletedAt) {
      throw new NotFoundError('Workout not found');
    }
    return workout;
  }

  private assertExercises(exercises: WorkoutExerciseCommandInput[]): void {
    if (!exercises.length) {
      throw new BusinessError(
        'Workout must include at least one exercise',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    const positions = new Set<number>();
    for (const exercise of exercises) {
      if (positions.has(exercise.position)) {
        throw new BusinessError(
          'Exercise positions must be unique',
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
      }
      positions.add(exercise.position);
      this.assertSets(exercise.sets);
    }
  }

  private assertSets(sets: WorkoutSetCommandInput[]): void {
    if (!sets.length) {
      throw new BusinessError(
        'Each exercise must include at least one set',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    const numbers = new Set<number>();
    for (const set of sets) {
      if (numbers.has(set.setNumber)) {
        throw new BusinessError(
          'Set numbers must be unique within an exercise',
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
      }
      numbers.add(set.setNumber);
      if (set.reps !== undefined && set.reps !== null && set.reps < 0) {
        throw new BusinessError(
          'reps must be >= 0',
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
      }
      if (set.weight !== undefined && set.weight !== null && set.weight < 0) {
        throw new BusinessError(
          'weight must be >= 0',
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
      }
    }
  }

  private assertCompletable(exercises: WorkoutExerciseCommandInput[]): void {
    const working = exercises.some((exercise) =>
      exercise.sets.some((set) => !set.isWarmup),
    );
    if (!working) {
      throw new BusinessError(
        'Cannot complete a workout with no working sets',
        ErrorCodes.BUSINESS_ERROR,
      );
    }
  }

  private async assertExerciseIdsExist(
    exercises: WorkoutExerciseCommandInput[],
  ): Promise<void> {
    for (const exercise of exercises) {
      const exists = await this.workouts.exerciseExists(exercise.exerciseId);
      if (!exists) {
        throw new BusinessError(
          `Unknown exerciseId: ${exercise.exerciseId}`,
          ErrorCodes.VALIDATION_ERROR,
          400,
        );
      }
    }
  }

  private toRepoExercises(
    exercises: WorkoutExerciseCommandInput[],
  ): WorkoutExerciseInput[] {
    return exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      position: exercise.position,
      notes: exercise.notes ?? null,
      sets: exercise.sets.map((set) => this.toRepoSet(set)),
    }));
  }

  private toRepoSet(set: WorkoutSetCommandInput): WorkoutSetInput {
    return {
      setNumber: set.setNumber,
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      weightUnit: set.weightUnit,
      rpe: set.rpe ?? null,
      durationSec: set.durationSec ?? null,
      distanceM: set.distanceM ?? null,
      isWarmup: set.isWarmup ?? false,
      isFailure: set.isFailure ?? false,
      notes: set.notes ?? null,
    };
  }

  private async emitCompleted(workout: Workout): Promise<void> {
    const event = new WorkoutCompletedEvent(
      workout.id,
      workout.userId,
      workout.completedAt ?? new Date(),
    );
    await this.events.publish(event.eventName, event);
  }

  private toView(workout: Workout): WorkoutView {
    return {
      id: workout.id,
      userId: workout.userId,
      title: workout.title,
      notes: workout.notes,
      source: workout.source,
      status: workout.status,
      startedAt: workout.startedAt,
      completedAt: workout.completedAt,
      durationSec: workout.durationSec,
      exercises: workout.exercises.map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        exerciseSlug: exercise.exerciseSlug,
        position: exercise.position,
        notes: exercise.notes,
        sets: exercise.sets.map((set) => ({
          id: set.id,
          setNumber: set.setNumber,
          reps: set.reps,
          weight: set.weight,
          weightUnit: set.weightUnit,
          weightKg: set.weightKg,
          rpe: set.rpe,
          durationSec: set.durationSec,
          distanceM: set.distanceM,
          isWarmup: set.isWarmup,
          isFailure: set.isFailure,
          notes: set.notes,
        })),
      })),
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
    };
  }
}
