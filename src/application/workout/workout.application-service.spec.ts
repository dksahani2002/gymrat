import { WorkoutApplicationService } from './workout.application-service';
import { Workout } from '../../domain/workout/workout.entity';
import {
  WeightUnit,
  WorkoutSource,
  WorkoutStatus,
} from '../../domain/workout/workout.enums';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';

describe('WorkoutApplicationService', () => {
  const context = { ip: '127.0.0.1', userAgent: 'jest', requestId: 'req-1' };
  const exerciseId = '11111111-1111-1111-1111-111111111111';

  const workouts = {
    create: jest.fn(),
    findByIdForUser: jest.fn(),
    list: jest.fn(),
    updateMeta: jest.fn(),
    replaceExercises: jest.fn(),
    softDelete: jest.fn(),
    complete: jest.fn(),
    addExercise: jest.fn(),
    updateExercise: jest.fn(),
    removeExercise: jest.fn(),
    addSet: jest.fn(),
    updateSet: jest.fn(),
    removeSet: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    saveIdempotencyKey: jest.fn(),
    exerciseExists: jest.fn().mockResolvedValue(true),
  };

  const audit = { record: jest.fn() };
  const events = { publish: jest.fn() };

  let service: WorkoutApplicationService;

  const sample = Workout.create({
    id: 'wo-1',
    userId: 'user-1',
    title: 'Push Day',
    notes: null,
    source: WorkoutSource.MANUAL,
    status: WorkoutStatus.IN_PROGRESS,
    startedAt: new Date('2026-07-26T10:00:00Z'),
    completedAt: null,
    durationSec: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    exercises: [
      {
        id: 'we-1',
        exerciseId,
        exerciseName: 'Bench Press',
        exerciseSlug: 'bench-press',
        position: 1,
        notes: null,
        sets: [
          {
            id: 'ws-1',
            setNumber: 1,
            reps: 5,
            weight: 80,
            weightUnit: WeightUnit.KG,
            weightKg: 80,
            rpe: null,
            durationSec: null,
            distanceM: null,
            isWarmup: false,
            isFailure: false,
            notes: null,
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    workouts.exerciseExists.mockResolvedValue(true);
    service = new WorkoutApplicationService(
      workouts as never,
      audit as never,
      events as never,
    );
  });

  it('creates a workout and stores idempotency key', async () => {
    workouts.findByIdempotencyKey.mockResolvedValue(null);
    workouts.create.mockResolvedValue(sample);

    const result = await service.create({
      userId: 'user-1',
      title: 'Push Day',
      idempotencyKey: 'key-1',
      exercises: [
        {
          exerciseId,
          position: 1,
          sets: [
            { setNumber: 1, reps: 5, weight: 80, weightUnit: WeightUnit.KG },
          ],
        },
      ],
      context,
    });

    expect(result.title).toBe('Push Day');
    expect(workouts.saveIdempotencyKey).toHaveBeenCalled();
  });

  it('returns existing workout for idempotent replay', async () => {
    workouts.findByIdempotencyKey.mockResolvedValue(sample);
    const result = await service.create({
      userId: 'user-1',
      idempotencyKey: 'key-1',
      exercises: [
        {
          exerciseId,
          position: 1,
          sets: [{ setNumber: 1, reps: 5, weight: 80 }],
        },
      ],
      context,
    });
    expect(workouts.create).not.toHaveBeenCalled();
    expect(result.id).toBe('wo-1');
  });

  it('completes a workout and emits event', async () => {
    workouts.findByIdForUser.mockResolvedValue(sample);
    const completed = Workout.create({
      ...sample,
      status: WorkoutStatus.COMPLETED,
      completedAt: new Date(),
      durationSec: 3600,
    });
    workouts.complete.mockResolvedValue(completed);

    const result = await service.complete('user-1', 'wo-1', context);
    expect(result.status).toBe(WorkoutStatus.COMPLETED);
    expect(events.publish).toHaveBeenCalledWith(
      'workout.completed',
      expect.anything(),
    );
  });

  it('rejects complete with only warmup sets', async () => {
    const warmupOnly = Workout.create({
      ...sample,
      exercises: [
        {
          ...sample.exercises[0],
          sets: [{ ...sample.exercises[0].sets[0], isWarmup: true }],
        },
      ],
    });
    workouts.findByIdForUser.mockResolvedValue(warmupOnly);

    await expect(
      service.complete('user-1', 'wo-1', context),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('throws not found for other users workouts', async () => {
    workouts.findByIdForUser.mockResolvedValue(null);
    await expect(
      service.getById('user-1', 'wo-missing'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists workouts', async () => {
    workouts.list.mockResolvedValue({ items: [sample], nextCursor: null });
    const result = await service.list({ userId: 'user-1', limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('updates meta and replaces exercises', async () => {
    workouts.findByIdForUser.mockResolvedValue(sample);
    workouts.updateMeta.mockResolvedValue(sample);
    workouts.replaceExercises.mockResolvedValue(sample);

    const result = await service.update({
      userId: 'user-1',
      workoutId: 'wo-1',
      title: 'Updated',
      notes: 'n',
      exercises: [
        {
          exerciseId,
          position: 1,
          sets: [
            { setNumber: 1, reps: 8, weight: 70, weightUnit: WeightUnit.KG },
          ],
        },
      ],
      context,
    });

    expect(result.id).toBe('wo-1');
    expect(workouts.replaceExercises).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
  });

  it('soft-deletes and emits deleted event', async () => {
    workouts.findByIdForUser.mockResolvedValue(sample);
    await service.softDelete('user-1', 'wo-1', context);
    expect(workouts.softDelete).toHaveBeenCalledWith('wo-1', 'user-1');
    expect(events.publish).toHaveBeenCalledWith(
      'workout.deleted',
      expect.anything(),
    );
  });

  it('returns already-completed workout without re-emitting', async () => {
    const completed = Workout.create({
      ...sample,
      status: WorkoutStatus.COMPLETED,
      completedAt: new Date(),
      durationSec: 100,
    });
    workouts.findByIdForUser.mockResolvedValue(completed);
    const result = await service.complete('user-1', 'wo-1', context);
    expect(result.status).toBe(WorkoutStatus.COMPLETED);
    expect(workouts.complete).not.toHaveBeenCalled();
  });

  it('adds and removes exercises and sets', async () => {
    workouts.findByIdForUser.mockResolvedValue(sample);
    workouts.addExercise.mockResolvedValue(sample);
    workouts.updateExercise.mockResolvedValue(sample);
    workouts.removeExercise.mockResolvedValue(sample);
    workouts.addSet.mockResolvedValue(sample);
    workouts.updateSet.mockResolvedValue(sample);
    workouts.removeSet.mockResolvedValue(sample);

    await service.addExercise(
      'user-1',
      'wo-1',
      {
        exerciseId,
        position: 2,
        sets: [
          { setNumber: 1, reps: 10, weight: 40, weightUnit: WeightUnit.KG },
        ],
      },
      context,
    );
    await service.updateExercise(
      'user-1',
      'wo-1',
      'we-1',
      { notes: 'x' },
      context,
    );
    await service.removeExercise('user-1', 'wo-1', 'we-1', context);
    await service.addSet(
      'user-1',
      'wo-1',
      'we-1',
      { setNumber: 2, reps: 5, weight: 80, weightUnit: WeightUnit.KG },
      context,
    );
    await service.updateSet('user-1', 'wo-1', 'ws-1', { reps: 6 }, context);
    await service.removeSet('user-1', 'wo-1', 'ws-1', context);

    expect(workouts.addExercise).toHaveBeenCalled();
    expect(workouts.removeSet).toHaveBeenCalled();
  });

  it('rejects create with invalid startedAt', async () => {
    workouts.findByIdempotencyKey.mockResolvedValue(null);
    await expect(
      service.create({
        userId: 'user-1',
        startedAt: 'not-a-date',
        exercises: [
          {
            exerciseId,
            position: 1,
            sets: [
              { setNumber: 1, reps: 5, weight: 80, weightUnit: WeightUnit.KG },
            ],
          },
        ],
        context,
      }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('creates and completes in one request when completed=true', async () => {
    workouts.findByIdempotencyKey.mockResolvedValue(null);
    const completed = Workout.create({
      ...sample,
      status: WorkoutStatus.COMPLETED,
      completedAt: new Date(),
      durationSec: 0,
    });
    workouts.create.mockResolvedValue(completed);

    const result = await service.create({
      userId: 'user-1',
      completed: true,
      exercises: [
        {
          exerciseId,
          position: 1,
          sets: [
            { setNumber: 1, reps: 5, weight: 80, weightUnit: WeightUnit.KG },
          ],
        },
      ],
      context,
    });

    expect(result.status).toBe(WorkoutStatus.COMPLETED);
    expect(events.publish).toHaveBeenCalledWith(
      'workout.completed',
      expect.anything(),
    );
  });
});
