import { NotificationsApplicationService } from './notifications.application-service';
import { Notification } from '../../domain/notification/notification.entity';
import { BusinessError } from '../../shared/errors/base.error';

describe('NotificationsApplicationService', () => {
  const notifications = {
    create: jest.fn(),
    list: jest.fn(),
    findByIdForUser: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    upsertPushToken: jest.fn(),
  };

  let service: NotificationsApplicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsApplicationService(notifications as never);
  });

  it('lists inbox with unread count', async () => {
    notifications.list.mockResolvedValue({
      items: [
        Notification.create({
          id: 'n-1',
          userId: 'user-1',
          channel: 'IN_APP',
          type: 'pr.achieved',
          title: 'PR',
          body: 'Bench',
          payload: null,
          readAt: null,
          createdAt: new Date(),
        }),
      ],
      nextCursor: null,
      unreadCount: 1,
    });

    const result = await service.list({ userId: 'user-1' });
    expect(result.unreadCount).toBe(1);
    expect(result.items[0].isRead).toBe(false);
  });

  it('skips PR alerts when preference disabled', async () => {
    notifications.getPreferences.mockResolvedValue({
      emailEnabled: true,
      pushEnabled: true,
      workoutReminders: true,
      prAlerts: false,
      weeklySummary: true,
    });

    const result = await service.notifyInApp({
      userId: 'user-1',
      type: 'pr.achieved',
      title: 'PR',
      body: 'x',
      respectPrAlerts: true,
    });

    expect(result).toBeNull();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('creates in-app notification when allowed', async () => {
    notifications.create.mockResolvedValue(
      Notification.create({
        id: 'n-1',
        userId: 'user-1',
        channel: 'IN_APP',
        type: 'goal.completed',
        title: 'Goal',
        body: 'done',
        payload: { goalId: 'g-1' },
        readAt: null,
        createdAt: new Date(),
      }),
    );

    const result = await service.notifyInApp({
      userId: 'user-1',
      type: 'goal.completed',
      title: 'Goal',
      body: 'done',
      payload: { goalId: 'g-1' },
    });

    expect(result?.type).toBe('goal.completed');
  });

  it('registers push tokens for valid platforms', async () => {
    notifications.upsertPushToken.mockResolvedValue({
      id: 't-1',
      token: 'abcd1234token',
      platform: 'ios',
    });

    const result = await service.registerPushToken({
      userId: 'user-1',
      token: 'abcd1234token',
      platform: 'IOS',
    });

    expect(result.platform).toBe('ios');
  });

  it('rejects invalid push platform', async () => {
    await expect(
      service.registerPushToken({
        userId: 'user-1',
        token: 'abcd1234token',
        platform: 'blackberry',
      }),
    ).rejects.toBeInstanceOf(BusinessError);
  });
});
