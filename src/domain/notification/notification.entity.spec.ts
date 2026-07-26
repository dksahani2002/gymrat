import { DevicePushToken, Notification } from './notification.entity';

describe('Notification entities', () => {
  it('exposes isRead from readAt', () => {
    const unread = Notification.create({
      id: 'n-1',
      userId: 'user-1',
      channel: 'IN_APP',
      type: 'PR',
      title: 'PR',
      body: 'New PR',
      payload: null,
      readAt: null,
      createdAt: new Date(),
    });
    expect(unread.isRead).toBe(false);

    const read = Notification.create({
      id: 'n-2',
      userId: 'user-1',
      channel: 'IN_APP',
      type: 'PR',
      title: 'PR',
      body: 'New PR',
      payload: { prId: 'pr-1' },
      readAt: new Date(),
      createdAt: new Date(),
    });
    expect(read.isRead).toBe(true);
  });

  it('creates device push tokens', () => {
    const token = DevicePushToken.create({
      id: 't-1',
      userId: 'user-1',
      token: 'abc',
      platform: 'ios',
      createdAt: new Date(),
      revokedAt: null,
    });
    expect(token.platform).toBe('ios');
    expect(token.revokedAt).toBeNull();
  });
});
