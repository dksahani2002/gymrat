import {
  DevicePushToken,
  Notification,
  NotificationChannel,
  NotificationPreferences,
} from '../notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface CreateNotificationInput {
  userId: string;
  channel?: NotificationChannel;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
}

export interface ListNotificationsFilters {
  userId: string;
  unreadOnly?: boolean;
  limit: number;
  cursor?: string | null;
}

export interface ListNotificationsResult {
  items: Notification[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  list(filters: ListNotificationsFilters): Promise<ListNotificationsResult>;
  findByIdForUser(id: string, userId: string): Promise<Notification | null>;
  markRead(id: string, userId: string): Promise<Notification>;
  markAllRead(userId: string): Promise<number>;
  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(
    userId: string,
    input: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences>;
  upsertPushToken(input: {
    userId: string;
    token: string;
    platform: string;
  }): Promise<DevicePushToken>;
}
