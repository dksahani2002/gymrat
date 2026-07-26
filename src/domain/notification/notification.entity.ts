import { Entity } from '../common/entity.base';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH';

export interface NotificationProps {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export class Notification extends Entity {
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly payload: Record<string, unknown> | null;
  readonly readAt: Date | null;
  readonly createdAt: Date;

  private constructor(props: NotificationProps) {
    super(props.id);
    this.userId = props.userId;
    this.channel = props.channel;
    this.type = props.type;
    this.title = props.title;
    this.body = props.body;
    this.payload = props.payload;
    this.readAt = props.readAt;
    this.createdAt = props.createdAt;
  }

  static create(props: NotificationProps): Notification {
    return new Notification(props);
  }

  get isRead(): boolean {
    return this.readAt !== null;
  }
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  workoutReminders: boolean;
  prAlerts: boolean;
  weeklySummary: boolean;
}

export interface DevicePushTokenProps {
  id: string;
  userId: string;
  token: string;
  platform: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export class DevicePushToken extends Entity {
  readonly userId: string;
  readonly token: string;
  readonly platform: string;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;

  private constructor(props: DevicePushTokenProps) {
    super(props.id);
    this.userId = props.userId;
    this.token = props.token;
    this.platform = props.platform;
    this.createdAt = props.createdAt;
    this.revokedAt = props.revokedAt;
  }

  static create(props: DevicePushTokenProps): DevicePushToken {
    return new DevicePushToken(props);
  }
}
