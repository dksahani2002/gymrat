import { GoalsApplicationService } from './goals.application-service';
import { Goal } from '../../domain/goal/goal.entity';
import { GoalStatus, GoalType } from '../../domain/goal/goal.enums';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';

describe('GoalsApplicationService', () => {
  const goals = {
    create: jest.fn(),
    findByIdForUser: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    exerciseExists: jest.fn(),
    listActiveByUser: jest.fn(),
    strengthBestKg: jest.fn(),
    latestBodyWeightKg: jest.fn(),
    bodyWeightNear: jest.fn(),
    completedWorkoutCount: jest.fn(),
    totalVolumeKg: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const events = { publish: jest.fn() };
  const context = { ip: '127.0.0.1', userAgent: 'test', requestId: 'req-1' };

  let service: GoalsApplicationService;

  const sample = Goal.create({
    id: 'g-1',
    userId: 'user-1',
    type: GoalType.FREQUENCY,
    title: '12 workouts',
    targetValue: 12,
    targetUnit: 'workouts',
    exerciseId: null,
    status: GoalStatus.ACTIVE,
    startsAt: new Date('2026-07-01T00:00:00Z'),
    targetDate: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GoalsApplicationService(
      goals as never,
      audit as never,
      events as never,
    );
  });

  it('creates a frequency goal and returns progress', async () => {
    goals.create.mockResolvedValue(sample);
    goals.completedWorkoutCount.mockResolvedValue(3);

    const result = await service.create({
      userId: 'user-1',
      type: GoalType.FREQUENCY,
      title: '12 workouts',
      targetValue: 12,
      startsAt: '2026-07-01T00:00:00.000Z',
      context,
    });

    expect(result.progress.currentValue).toBe(3);
    expect(result.progress.percent).toBe(0.25);
    expect(events.publish).toHaveBeenCalledWith(
      'goal.created',
      expect.anything(),
    );
  });

  it('requires exerciseId for STRENGTH goals', async () => {
    await expect(
      service.create({
        userId: 'user-1',
        type: GoalType.STRENGTH,
        title: 'Bench 100',
        targetValue: 100,
        context,
      }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('completes a goal', async () => {
    goals.findByIdForUser.mockResolvedValue(sample);
    goals.update.mockResolvedValue(
      Goal.create({
        ...sample,
        status: GoalStatus.COMPLETED,
        completedAt: new Date(),
      }),
    );
    goals.completedWorkoutCount.mockResolvedValue(12);

    const result = await service.complete('user-1', 'g-1', context);
    expect(result.status).toBe(GoalStatus.COMPLETED);
    expect(events.publish).toHaveBeenCalledWith(
      'goal.completed',
      expect.anything(),
    );
  });

  it('auto-completes achieved active goals', async () => {
    goals.listActiveByUser.mockResolvedValue([sample]);
    goals.completedWorkoutCount.mockResolvedValue(12);
    goals.update.mockResolvedValue(
      Goal.create({
        ...sample,
        status: GoalStatus.COMPLETED,
        completedAt: new Date(),
      }),
    );

    await service.evaluateActiveGoals('user-1');
    expect(goals.update).toHaveBeenCalledWith(
      'g-1',
      'user-1',
      expect.objectContaining({ status: GoalStatus.COMPLETED }),
    );
  });

  it('throws when goal missing', async () => {
    goals.findByIdForUser.mockResolvedValue(null);
    await expect(service.getById('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('lists goals and soft-deletes', async () => {
    goals.list.mockResolvedValue({ items: [sample], nextCursor: null });
    goals.completedWorkoutCount.mockResolvedValue(3);
    goals.findByIdForUser.mockResolvedValue(sample);

    const listed = await service.list({ userId: 'user-1' });
    expect(listed.items).toHaveLength(1);

    await service.softDelete('user-1', 'g-1', context);
    expect(goals.softDelete).toHaveBeenCalledWith('g-1', 'user-1');
    expect(events.publish).toHaveBeenCalledWith(
      'goal.deleted',
      expect.anything(),
    );
  });

  it('updates an active goal', async () => {
    goals.findByIdForUser.mockResolvedValue(sample);
    goals.update.mockResolvedValue(
      Goal.create({ ...sample, title: '20 workouts', targetValue: 20 }),
    );
    goals.completedWorkoutCount.mockResolvedValue(5);

    const result = await service.update({
      userId: 'user-1',
      goalId: 'g-1',
      title: '20 workouts',
      targetValue: 20,
      context,
    });
    expect(result.title).toBe('20 workouts');
  });

  it('computes strength, body-weight, and volume progress', async () => {
    const strength = Goal.create({
      ...sample,
      id: 'g-s',
      type: GoalType.STRENGTH,
      exerciseId: 'ex-1',
      targetValue: 100,
      targetUnit: 'KG',
    });
    goals.findByIdForUser.mockResolvedValue(strength);
    goals.strengthBestKg.mockResolvedValue(80);
    const s = await service.getById('user-1', 'g-s');
    expect(s.progress.percent).toBe(0.8);

    const bw = Goal.create({
      ...sample,
      id: 'g-bw',
      type: GoalType.BODY_WEIGHT,
      targetValue: 75,
      targetUnit: 'KG',
    });
    goals.findByIdForUser.mockResolvedValue(bw);
    goals.latestBodyWeightKg.mockResolvedValue(78);
    goals.bodyWeightNear.mockResolvedValue(82);
    const body = await service.getById('user-1', 'g-bw');
    expect(body.progress.baselineValue).toBe(82);
    expect(body.progress.currentValue).toBe(78);

    const volume = Goal.create({
      ...sample,
      id: 'g-v',
      type: GoalType.VOLUME,
      targetValue: 10000,
      targetUnit: 'KG',
    });
    goals.findByIdForUser.mockResolvedValue(volume);
    goals.totalVolumeKg.mockResolvedValue(2500);
    const v = await service.getById('user-1', 'g-v');
    expect(v.progress.percent).toBe(0.25);
  });

  it('returns completed goal without re-completing', async () => {
    const done = Goal.create({
      ...sample,
      status: GoalStatus.COMPLETED,
      completedAt: new Date(),
    });
    goals.findByIdForUser.mockResolvedValue(done);
    goals.completedWorkoutCount.mockResolvedValue(12);
    const result = await service.complete('user-1', 'g-1', context);
    expect(goals.update).not.toHaveBeenCalled();
    expect(result.status).toBe(GoalStatus.COMPLETED);
  });
});
