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
          sets: [{ setNumber: 1, reps: 5, weight: 80, weightUnit: WeightUnit.KG }],
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

    await expect(service.complete('user-1', 'wo-1', context)).rejects.toBeInstanceOf(
      BusinessError,
    );
  });

  it('throws not found for other users workouts', async () => {
    workouts.findByIdForUser.mockResolvedValue(null);
    await expect(service.getById('user-1', 'wo-missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
