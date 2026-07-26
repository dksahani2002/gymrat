import { ExerciseApplicationService } from './exercise.application-service';
import { Exercise } from '../../domain/exercise/exercise.entity';
import { MuscleRole } from '../../domain/exercise/exercise.enums';
import { Role } from '../../domain/identity/role.enum';
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from '../../shared/errors/base.error';

describe('ExerciseApplicationService', () => {
  const context = { ip: '127.0.0.1', userAgent: 'jest', requestId: 'req-1' };

  const exercises = {
    search: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    listCategories: jest.fn(),
    listMuscleGroups: jest.fn(),
    listEquipment: jest.fn(),
    muscleGroupsExist: jest.fn().mockResolvedValue(true),
  };

  const audit = { record: jest.fn() };
  const events = { publish: jest.fn() };
  const redis = {
    raw: {
      get: jest.fn().mockResolvedValue('1'),
      set: jest.fn(),
      incr: jest.fn(),
    },
  };

  let service: ExerciseApplicationService;

  const sample = Exercise.create({
    id: 'ex-1',
    slug: 'bench-press',
    name: 'Bench Press',
    description: null,
    categoryId: 'cat-1',
    categorySlug: 'push',
    categoryName: 'Push',
    equipmentId: 'eq-1',
    equipmentSlug: 'barbell',
    equipmentName: 'Barbell',
    isCustom: false,
    createdById: null,
    isActive: true,
    aliases: ['bench'],
    muscles: [
      {
        muscleGroupId: 'm-1',
        muscleGroupSlug: 'chest',
        muscleGroupName: 'Chest',
        role: MuscleRole.PRIMARY,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    redis.raw.get.mockResolvedValue('1');
    exercises.listCategories.mockResolvedValue([
      { id: 'cat-1', slug: 'push', name: 'Push' },
    ]);
    exercises.listEquipment.mockResolvedValue([
      { id: 'eq-1', slug: 'barbell', name: 'Barbell' },
    ]);
    exercises.muscleGroupsExist.mockResolvedValue(true);
    service = new ExerciseApplicationService(
      exercises as never,
      audit as never,
      events as never,
      redis as never,
    );
  });

  it('searches exercises', async () => {
    exercises.search.mockResolvedValue({ items: [sample], nextCursor: null });
    const result = await service.search({
      q: 'bench',
      actorUserId: 'user-1',
      limit: 20,
    });
    expect(result.items[0].name).toBe('Bench Press');
    expect(result.items[0].aliases).toContain('bench');
  });

  it('creates custom exercises for regular users', async () => {
    exercises.findBySlug.mockResolvedValue(null);
    exercises.create.mockResolvedValue(
      Exercise.create({ ...sample, isCustom: true, createdById: 'user-1' }),
    );

    const result = await service.create({
      actorUserId: 'user-1',
      actorRole: Role.USER,
      name: 'My Fly',
      context,
    });

    expect(exercises.create).toHaveBeenCalledWith(
      expect.objectContaining({ isCustom: true, createdById: 'user-1' }),
    );
    expect(result.isCustom).toBe(true);
  });

  it('rejects duplicate slugs', async () => {
    exercises.findBySlug.mockResolvedValue(sample);
    await expect(
      service.create({
        actorUserId: 'admin-1',
        actorRole: Role.ADMIN,
        name: 'Bench Press',
        context,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('blocks non-owners from updating global exercises', async () => {
    exercises.findById.mockResolvedValue(sample);
    await expect(
      service.update({
        actorUserId: 'user-1',
        actorRole: Role.USER,
        exerciseId: 'ex-1',
        name: 'Hacked',
        context,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('soft-deletes when owner', async () => {
    const custom = Exercise.create({
      ...sample,
      isCustom: true,
      createdById: 'user-1',
    });
    exercises.findById.mockResolvedValue(custom);

    await service.softDelete({
      actorUserId: 'user-1',
      actorRole: Role.USER,
      exerciseId: 'ex-1',
      context,
    });

    expect(exercises.softDelete).toHaveBeenCalledWith('ex-1');
    expect(redis.raw.incr).toHaveBeenCalled();
  });

  it('returns 404 for missing exercise', async () => {
    exercises.findById.mockResolvedValue(null);
    await expect(service.getById('missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('caches category lists', async () => {
    redis.raw.get.mockResolvedValueOnce('2').mockResolvedValueOnce(null);
    exercises.listCategories.mockResolvedValue([
      { id: 'cat-1', slug: 'push', name: 'Push' },
    ]);

    const result = await service.listCategories();
    expect(result[0].slug).toBe('push');
    expect(redis.raw.set).toHaveBeenCalled();
  });

  it('returns cached taxonomy lists and allows admin updates', async () => {
    redis.raw.get.mockResolvedValue(
      JSON.stringify([{ id: 'm-1', slug: 'chest', name: 'Chest' }]),
    );
    const muscles = await service.listMuscles();
    expect(muscles[0].slug).toBe('chest');
    expect(exercises.listMuscleGroups).not.toHaveBeenCalled();

    redis.raw.get.mockResolvedValue(
      JSON.stringify([{ id: 'eq-1', slug: 'barbell', name: 'Barbell' }]),
    );
    const equipment = await service.listEquipment();
    expect(equipment[0].slug).toBe('barbell');

    exercises.findById.mockResolvedValue(sample);
    exercises.update.mockResolvedValue(
      Exercise.create({ ...sample, name: 'Bench Press v2' }),
    );
    const updated = await service.update({
      actorUserId: 'admin-1',
      actorRole: Role.ADMIN,
      exerciseId: 'ex-1',
      name: 'Bench Press v2',
      context,
    });
    expect(updated.name).toBe('Bench Press v2');
  });

  it('hides other users custom exercises', async () => {
    exercises.findById.mockResolvedValue(
      Exercise.create({
        ...sample,
        isCustom: true,
        createdById: 'other',
      }),
    );
    await expect(service.getById('ex-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
