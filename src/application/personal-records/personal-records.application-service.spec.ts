import { PersonalRecordsApplicationService } from './personal-records.application-service';
import { PrType } from '../../domain/personal-record/pr-type.enum';
import { Workout } from '../../domain/workout/workout.entity';
import {
  WeightUnit,
  WorkoutSource,
  WorkoutStatus,
} from '../../domain/workout/workout.enums';

describe('PersonalRecordsApplicationService', () => {
  const records = {
    createMany: jest.fn(),
    list: jest.fn(),
    findBests: jest.fn(),
  };
  const workouts = {
    findByIdForUser: jest.fn(),
  };
  const events = {
    publish: jest.fn(),
  };

  let service: PersonalRecordsApplicationService;

  const workout = Workout.create({
    id: 'wo-1',
    userId: 'user-1',
    title: 'Push',
    notes: null,
    source: WorkoutSource.MANUAL,
    status: WorkoutStatus.COMPLETED,
    startedAt: new Date('2026-01-01T10:00:00Z'),
    completedAt: new Date('2026-01-01T11:00:00Z'),
    durationSec: 3600,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    exercises: [
      {
        id: 'we-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exerciseSlug: 'bench-press',
        position: 1,
        notes: null,
        sets: [
          {
            id: 's-1',
            setNumber: 1,
            reps: 5,
            weight: 100,
            weightUnit: WeightUnit.KG,
            weightKg: 100,
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
    service = new PersonalRecordsApplicationService(
      records as never,
      workouts as never,
      events as never,
    );
  });

  it('creates new PRs and emits pr.achieved', async () => {
    workouts.findByIdForUser.mockResolvedValue(workout);
    records.findBests.mockResolvedValue([]);
    records.createMany.mockImplementation(async (inputs: unknown[]) =>
      (inputs as Array<{ type: PrType; value: number }>).map((input, i) => ({
        id: `pr-${i}`,
        userId: 'user-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        exerciseSlug: 'bench-press',
        type: input.type,
        value: input.value,
        unit: 'KG',
        workoutId: 'wo-1',
        achievedAt: workout.completedAt!,
        createdAt: new Date(),
      })),
    );

    const created = await service.detectForCompletedWorkout({
      workoutId: 'wo-1',
      userId: 'user-1',
      completedAt: workout.completedAt!,
    });

    expect(created.length).toBeGreaterThan(0);
    expect(records.createMany).toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(
      'pr.achieved',
      expect.objectContaining({ eventName: 'pr.achieved' }),
    );
  });

  it('skips persistence when nothing beats prior bests', async () => {
    workouts.findByIdForUser.mockResolvedValue(workout);
    records.findBests.mockResolvedValue([
      {
        exerciseId: 'ex-1',
        type: PrType.MAX_WEIGHT,
        value: 200,
      },
      {
        exerciseId: 'ex-1',
        type: PrType.MAX_REPS,
        value: 20,
      },
      {
        exerciseId: 'ex-1',
        type: PrType.MAX_VOLUME,
        value: 5000,
      },
      {
        exerciseId: 'ex-1',
        type: PrType.ESTIMATED_1RM,
        value: 300,
      },
    ]);

    const created = await service.detectForCompletedWorkout({
      workoutId: 'wo-1',
      userId: 'user-1',
      completedAt: workout.completedAt!,
    });

    expect(created).toEqual([]);
    expect(records.createMany).not.toHaveBeenCalled();
  });
});
