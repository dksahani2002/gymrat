import { BodyMeasurementApplicationService } from './body-measurement.application-service';
import { BodyMeasurement } from '../../domain/body-measurement/body-measurement.entity';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';

describe('BodyMeasurementApplicationService', () => {
  const entries = {
    create: jest.fn(),
    list: jest.fn(),
    findByIdForUser: jest.fn(),
    softDelete: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const events = { publish: jest.fn() };
  const context = { ip: '127.0.0.1', userAgent: 'test', requestId: 'req-1' };

  let service: BodyMeasurementApplicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BodyMeasurementApplicationService(
      entries as never,
      audit as never,
      events as never,
    );
  });

  it('creates a normalized measurement entry', async () => {
    const created = BodyMeasurement.create({
      id: 'm-1',
      userId: 'user-1',
      measurements: { chest: 102, waist: 81 },
      recordedAt: new Date('2026-07-26T10:00:00Z'),
      notes: null,
      createdAt: new Date(),
      deletedAt: null,
    });
    entries.create.mockResolvedValue(created);

    const result = await service.create({
      userId: 'user-1',
      measurements: { chest: 102.456, waist: 81 },
      recordedAt: '2026-07-26T10:00:00.000Z',
      context,
    });

    expect(entries.create).toHaveBeenCalledWith(
      expect.objectContaining({
        measurements: { chest: 102.46, waist: 81 },
      }),
    );
    expect(result.unit).toBe('CM');
    expect(events.publish).toHaveBeenCalledWith(
      'body_measurement.logged',
      expect.anything(),
    );
  });

  it('rejects empty measurements', async () => {
    await expect(
      service.create({ userId: 'user-1', measurements: {}, context }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('rejects invalid keys and out-of-range values', async () => {
    await expect(
      service.create({
        userId: 'user-1',
        measurements: { 'Chest!': 100 },
        context,
      }),
    ).rejects.toBeInstanceOf(BusinessError);

    await expect(
      service.create({
        userId: 'user-1',
        measurements: { waist: 400 },
        context,
      }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('soft-deletes an owned entry', async () => {
    entries.findByIdForUser.mockResolvedValue(
      BodyMeasurement.create({
        id: 'm-1',
        userId: 'user-1',
        measurements: { waist: 80 },
        recordedAt: new Date(),
        notes: null,
        createdAt: new Date(),
        deletedAt: null,
      }),
    );

    await service.softDelete('user-1', 'm-1', context);
    expect(entries.softDelete).toHaveBeenCalledWith('m-1', 'user-1');
  });

  it('throws when deleting missing entry', async () => {
    entries.findByIdForUser.mockResolvedValue(null);
    await expect(
      service.softDelete('user-1', 'missing', context),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
