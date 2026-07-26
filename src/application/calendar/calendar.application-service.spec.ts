import { CalendarApplicationService } from './calendar.application-service';
import { PlannedWorkout } from '../../domain/calendar/planned-workout.entity';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';

describe('CalendarApplicationService', () => {
  const calendar = {
    getUserTimezone: jest.fn(),
    listCompletedInRange: jest.fn(),
    listPlannedInRange: jest.fn(),
    createPlanned: jest.fn(),
    findPlannedByIdForUser: jest.fn(),
    updatePlanned: jest.fn(),
    softDeletePlanned: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const context = { ip: '127.0.0.1', userAgent: 'test', requestId: 'req-1' };

  let service: CalendarApplicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CalendarApplicationService(calendar as never, audit as never);
  });

  it('merges completed and planned into day buckets', async () => {
    calendar.getUserTimezone.mockResolvedValue('UTC');
    calendar.listCompletedInRange.mockResolvedValue([
      {
        id: 'w-1',
        title: 'Push',
        date: '2026-07-26',
        status: 'COMPLETED',
        durationSec: 3600,
        startedAt: new Date('2026-07-26T10:00:00Z'),
        completedAt: new Date('2026-07-26T11:00:00Z'),
      },
    ]);
    calendar.listPlannedInRange.mockResolvedValue([
      PlannedWorkout.create({
        id: 'p-1',
        userId: 'user-1',
        title: 'Legs',
        plannedDate: '2026-07-28',
        notes: null,
        createdAt: new Date(),
        deletedAt: null,
      }),
    ]);

    const result = await service.getRange({
      userId: 'user-1',
      from: '2026-07-01',
      to: '2026-07-31',
    });

    expect(result.days).toHaveLength(2);
    expect(result.days[0].date).toBe('2026-07-26');
    expect(result.days[0].completed).toHaveLength(1);
    expect(result.days[1].planned[0].title).toBe('Legs');
  });

  it('rejects oversized ranges', async () => {
    await expect(
      service.getRange({
        userId: 'user-1',
        from: '2026-01-01',
        to: '2026-06-01',
      }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('creates a planned marker', async () => {
    calendar.createPlanned.mockResolvedValue(
      PlannedWorkout.create({
        id: 'p-1',
        userId: 'user-1',
        title: 'Push',
        plannedDate: '2026-07-28',
        notes: null,
        createdAt: new Date(),
        deletedAt: null,
      }),
    );

    const result = await service.createPlanned({
      userId: 'user-1',
      plannedDate: '2026-07-28',
      title: 'Push',
      context,
    });

    expect(result.plannedDate).toBe('2026-07-28');
    expect(audit.record).toHaveBeenCalled();
  });

  it('throws when updating missing planned marker', async () => {
    calendar.findPlannedByIdForUser.mockResolvedValue(null);
    await expect(
      service.updatePlanned({
        userId: 'user-1',
        id: 'missing',
        title: 'x',
        context,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
