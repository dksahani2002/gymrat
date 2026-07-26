import { BodyWeightApplicationService } from './body-weight.application-service';
import { BodyWeightEntry } from '../../domain/body-weight/body-weight-entry.entity';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';

describe('BodyWeightApplicationService', () => {
  const entries = {
    create: jest.fn(),
    list: jest.fn(),
    findByIdForUser: jest.fn(),
    softDelete: jest.fn(),
    listInRange: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const events = { publish: jest.fn() };

  let service: BodyWeightApplicationService;
  const context = { ip: '127.0.0.1', userAgent: 'test', requestId: 'req-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BodyWeightApplicationService(
      entries as never,
      audit as never,
      events as never,
    );
  });

  it('creates an entry with normalized weightKg', async () => {
    const created = BodyWeightEntry.create({
      id: 'bw-1',
      userId: 'user-1',
      weight: 180,
      unit: 'LB',
      weightKg: 81.65,
      recordedAt: new Date('2026-07-26T10:00:00Z'),
      notes: null,
      createdAt: new Date(),
      deletedAt: null,
    });
    entries.create.mockResolvedValue(created);

    const result = await service.create({
      userId: 'user-1',
      weight: 180,
      unit: 'LB',
      recordedAt: '2026-07-26T10:00:00.000Z',
      context,
    });

    expect(entries.create).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: 'LB',
        weight: 180,
        weightKg: expect.any(Number),
      }),
    );
    expect(result.weightKg).toBe(81.65);
    expect(events.publish).toHaveBeenCalledWith(
      'body_weight.logged',
      expect.anything(),
    );
  });

  it('rejects non-positive weight', async () => {
    await expect(
      service.create({ userId: 'user-1', weight: 0, context }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('soft-deletes an owned entry', async () => {
    entries.findByIdForUser.mockResolvedValue(
      BodyWeightEntry.create({
        id: 'bw-1',
        userId: 'user-1',
        weight: 80,
        unit: 'KG',
        weightKg: 80,
        recordedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        deletedAt: null,
      }),
    );

    await service.softDelete('user-1', 'bw-1', context);
    expect(entries.softDelete).toHaveBeenCalledWith('bw-1', 'user-1');
    expect(events.publish).toHaveBeenCalledWith(
      'body_weight.deleted',
      expect.anything(),
    );
  });

  it('throws when deleting missing entry', async () => {
    entries.findByIdForUser.mockResolvedValue(null);
    await expect(
      service.softDelete('user-1', 'bw-missing', context),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
