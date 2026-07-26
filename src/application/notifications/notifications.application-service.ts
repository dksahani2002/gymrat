import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationPreferences } from '../../domain/notification/notification.entity';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../domain/notification/repositories/notification.repository';
import { BusinessError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';

export interface NotificationView {
  id: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
  isRead: boolean;
}

/**
 * In-app notification inbox + preferences + push token registry.
 */
@Injectable()
export class NotificationsApplicationService {
  private readonly logger = new Logger(NotificationsApplicationService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  async list(input: {
    userId: string;
    unreadOnly?: boolean;
    limit?: number;
    cursor?: string | null;
  }): Promise<{
    items: NotificationView[];
    nextCursor: string | null;
    unreadCount: number;
  }> {
    const result = await this.notifications.list({
      userId: input.userId,
      unreadOnly: input.unreadOnly,
      limit: Math.min(Math.max(input.limit ?? 30, 1), 100),
      cursor: input.cursor,
    });
    return {
      items: result.items.map((item) => this.toView(item)),
      nextCursor: result.nextCursor,
      unreadCount: result.unreadCount,
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationView> {
    const updated = await this.notifications.markRead(id, userId);
    return this.toView(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const updated = await this.notifications.markAllRead(userId);
    return { updated };
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.notifications.getPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    input: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    return this.notifications.updatePreferences(userId, input);
  }

  async registerPushToken(input: {
    userId: string;
    token: string;
    platform: string;
  }): Promise<{ id: string; token: string; platform: string }> {
    const token = input.token?.trim();
    const platform = input.platform?.trim().toLowerCase();
    if (!token || token.length < 8 || token.length > 512) {
      throw new BusinessError(
        'token must be 8–512 characters',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
      throw new BusinessError(
        'platform must be ios, android, or web',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }

    const saved = await this.notifications.upsertPushToken({
      userId: input.userId,
      token,
      platform,
    });
    return { id: saved.id, token: saved.token, platform: saved.platform };
  }

  /**
   * Create an in-app notification (used by event listeners).
   */
  async notifyInApp(input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown> | null;
    respectPrAlerts?: boolean;
  }): Promise<NotificationView | null> {
    if (input.respectPrAlerts) {
      const prefs = await this.notifications.getPreferences(input.userId);
      if (!prefs.prAlerts) {
        this.logger.debug(`Skipping PR alert for user ${input.userId}`);
        return null;
      }
    }

    const created = await this.notifications.create({
      userId: input.userId,
      channel: 'IN_APP',
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ?? null,
    });
    return this.toView(created);
  }

  private toView(item: {
    id: string;
    type: string;
    channel: string;
    title: string;
    body: string;
    payload: Record<string, unknown> | null;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationView {
    return {
      id: item.id,
      type: item.type,
      channel: item.channel,
      title: item.title,
      body: item.body,
      payload: item.payload,
      readAt: item.readAt,
      createdAt: item.createdAt,
      isRead: item.readAt !== null,
    };
  }
}
