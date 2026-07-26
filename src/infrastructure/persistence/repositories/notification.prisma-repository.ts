import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DevicePushToken,
  Notification,
  NotificationChannel,
  NotificationPreferences,
} from '../../../domain/notification/notification.entity';
import {
  CreateNotificationInput,
  ListNotificationsFilters,
  ListNotificationsResult,
  NotificationRepository,
} from '../../../domain/notification/repositories/notification.repository';
import {
  NotFoundError,
  RepositoryError,
} from '../../../shared/errors/base.error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationPrismaRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    try {
      const row = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          channel: input.channel ?? 'IN_APP',
          type: input.type,
          title: input.title,
          body: input.body,
          payload:
            input.payload === undefined || input.payload === null
              ? undefined
              : (input.payload as Prisma.InputJsonValue),
        },
      });
      return this.toNotification(row);
    } catch (error) {
      throw new RepositoryError('Failed to create notification', error);
    }
  }

  async list(
    filters: ListNotificationsFilters,
  ): Promise<ListNotificationsResult> {
    const where: Prisma.NotificationWhereInput = {
      userId: filters.userId,
      ...(filters.unreadOnly ? { readAt: null } : {}),
    };

    if (filters.cursor) {
      const cursorRow = await this.prisma.notification.findFirst({
        where: { id: filters.cursor, userId: filters.userId },
      });
      if (cursorRow) {
        where.OR = [
          { createdAt: { lt: cursorRow.createdAt } },
          { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
        ];
      }
    }

    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: filters.limit + 1,
      }),
      this.prisma.notification.count({
        where: { userId: filters.userId, readAt: null },
      }),
    ]);

    const hasMore = rows.length > filters.limit;
    const page = hasMore ? rows.slice(0, filters.limit) : rows;
    return {
      items: page.map((row) => this.toNotification(row)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      unreadCount,
    };
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<Notification | null> {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    return row ? this.toNotification(row) : null;
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const existing = await this.findByIdForUser(id, userId);
    if (!existing) {
      throw new NotFoundError('Notification not found');
    }
    if (existing.readAt) {
      return existing;
    }
    const row = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toNotification(row);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    let row = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!row) {
      row = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }
    return {
      emailEnabled: row.emailEnabled,
      pushEnabled: row.pushEnabled,
      workoutReminders: row.workoutReminders,
      prAlerts: row.prAlerts,
      weeklySummary: row.weeklySummary,
    };
  }

  async updatePreferences(
    userId: string,
    input: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        emailEnabled: input.emailEnabled ?? true,
        pushEnabled: input.pushEnabled ?? true,
        workoutReminders: input.workoutReminders ?? true,
        prAlerts: input.prAlerts ?? true,
        weeklySummary: input.weeklySummary ?? true,
      },
      update: {
        ...(input.emailEnabled !== undefined
          ? { emailEnabled: input.emailEnabled }
          : {}),
        ...(input.pushEnabled !== undefined
          ? { pushEnabled: input.pushEnabled }
          : {}),
        ...(input.workoutReminders !== undefined
          ? { workoutReminders: input.workoutReminders }
          : {}),
        ...(input.prAlerts !== undefined ? { prAlerts: input.prAlerts } : {}),
        ...(input.weeklySummary !== undefined
          ? { weeklySummary: input.weeklySummary }
          : {}),
      },
    });
    return {
      emailEnabled: row.emailEnabled,
      pushEnabled: row.pushEnabled,
      workoutReminders: row.workoutReminders,
      prAlerts: row.prAlerts,
      weeklySummary: row.weeklySummary,
    };
  }

  async upsertPushToken(input: {
    userId: string;
    token: string;
    platform: string;
  }): Promise<DevicePushToken> {
    const row = await this.prisma.devicePushToken.upsert({
      where: {
        userId_token: { userId: input.userId, token: input.token },
      },
      create: {
        userId: input.userId,
        token: input.token,
        platform: input.platform,
      },
      update: {
        platform: input.platform,
        revokedAt: null,
      },
    });
    return DevicePushToken.create({
      id: row.id,
      userId: row.userId,
      token: row.token,
      platform: row.platform,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    });
  }

  private toNotification(row: {
    id: string;
    userId: string;
    channel: string;
    type: string;
    title: string;
    body: string;
    payload: Prisma.JsonValue | null;
    readAt: Date | null;
    createdAt: Date;
  }): Notification {
    return Notification.create({
      id: row.id,
      userId: row.userId,
      channel: row.channel as NotificationChannel,
      type: row.type,
      title: row.title,
      body: row.body,
      payload: this.parsePayload(row.payload),
      readAt: row.readAt,
      createdAt: row.createdAt,
    });
  }

  private parsePayload(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
