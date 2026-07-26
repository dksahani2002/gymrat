import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_PORT } from '../identity/ports/audit-log.port';
import type { AuditLogPort } from '../identity/ports/audit-log.port';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/identity/repositories/refresh-token.repository';
import type { RefreshTokenRepository } from '../../domain/identity/repositories/refresh-token.repository';
import { PROFILE_REPOSITORY } from '../../domain/profile/repositories/profile.repository';
import type { ProfileRepository } from '../../domain/profile/repositories/profile.repository';
import { UserProfile } from '../../domain/profile/user-profile.entity';
import {
  AccountDeletedEvent,
  ProfileUpdatedEvent,
} from '../../domain/profile/events/profile.events';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import type { EventBusPort } from '../../shared/events/event-bus.port';
import { BusinessError, NotFoundError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';
import {
  DeleteAccountCommand,
  PreferencesView,
  ProfileView,
  UpdatePreferencesCommand,
  UpdateProfileCommand,
} from './commands/profile.commands';

/**
 * Application service for user profile and preferences.
 */
@Injectable()
export class ProfileApplicationService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepository,
    @Inject(AUDIT_LOG_PORT) private readonly audit: AuditLogPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async getMe(userId: string): Promise<ProfileView> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Profile not found');
    }
    return this.toProfileView(profile);
  }

  async updateMe(command: UpdateProfileCommand): Promise<ProfileView> {
    this.assertTimezone(command.timezone);
    this.assertDateOfBirth(command.dateOfBirth);
    this.assertHeight(command.heightValue);

    const existing = await this.profiles.findByUserId(command.userId);
    if (!existing) {
      throw new NotFoundError('Profile not found');
    }

    const updated = await this.profiles.updateProfile(command.userId, {
      displayName:
        command.displayName === undefined
          ? undefined
          : command.displayName?.trim() || null,
      dateOfBirth:
        command.dateOfBirth === undefined
          ? undefined
          : command.dateOfBirth
            ? new Date(command.dateOfBirth)
            : null,
      gender: command.gender,
      heightValue: command.heightValue,
      heightUnit: command.heightUnit,
      fitnessGoal: command.fitnessGoal,
      activityLevel: command.activityLevel,
      preferredWeightUnit: command.preferredWeightUnit,
      timezone: command.timezone,
    });

    const event = new ProfileUpdatedEvent(command.userId);
    this.events.publish(event.eventName, event);

    await this.audit.record({
      actorId: command.userId,
      action: 'profile.update',
      resourceType: 'user_profile',
      resourceId: command.userId,
      beforeJson: this.toProfileView(existing),
      afterJson: this.toProfileView(updated),
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return this.toProfileView(updated);
  }

  async getPreferences(userId: string): Promise<PreferencesView> {
    const prefs = await this.profiles.getPreferences(userId);
    if (!prefs) {
      throw new NotFoundError('Preferences not found');
    }
    return prefs;
  }

  async updatePreferences(
    command: UpdatePreferencesCommand,
  ): Promise<PreferencesView> {
    this.assertTimezone(command.timezone);

    const existing = await this.profiles.getPreferences(command.userId);
    if (!existing) {
      throw new NotFoundError('Preferences not found');
    }

    const updated = await this.profiles.updatePreferences(command.userId, {
      preferredWeightUnit: command.preferredWeightUnit,
      heightUnit: command.heightUnit,
      timezone: command.timezone,
      notifications: command.notifications,
    });

    await this.audit.record({
      actorId: command.userId,
      action: 'profile.preferences_update',
      resourceType: 'user_preferences',
      resourceId: command.userId,
      beforeJson: existing,
      afterJson: updated,
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return updated;
  }

  async deleteAccount(command: DeleteAccountCommand): Promise<void> {
    const existing = await this.profiles.findByUserId(command.userId);
    if (!existing) {
      throw new NotFoundError('Profile not found');
    }

    await this.profiles.softDeleteAccount(command.userId);
    await this.refreshTokens.revokeAllForUser(command.userId);

    const event = new AccountDeletedEvent(command.userId);
    this.events.publish(event.eventName, event);

    await this.audit.record({
      actorId: command.userId,
      action: 'profile.account_deleted',
      resourceType: 'user',
      resourceId: command.userId,
      beforeJson: { email: existing.email },
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });
  }

  private toProfileView(profile: UserProfile): ProfileView {
    return {
      id: profile.id,
      userId: profile.userId,
      email: profile.email,
      role: profile.role,
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth
        ? profile.dateOfBirth.toISOString().slice(0, 10)
        : null,
      age: profile.age,
      gender: profile.gender,
      heightValue: profile.heightValue,
      heightUnit: profile.heightUnit,
      fitnessGoal: profile.fitnessGoal,
      activityLevel: profile.activityLevel,
      preferredWeightUnit: profile.preferredWeightUnit,
      timezone: profile.timezone,
      emailVerifiedAt: profile.emailVerifiedAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private assertTimezone(timezone?: string): void {
    if (timezone === undefined) {
      return;
    }
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new BusinessError(
        'Invalid timezone. Use an IANA timezone name (e.g. America/New_York).',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private assertDateOfBirth(dateOfBirth?: string | null): void {
    if (dateOfBirth === undefined || dateOfBirth === null) {
      return;
    }
    const parsed = new Date(dateOfBirth);
    if (Number.isNaN(parsed.getTime())) {
      throw new BusinessError(
        'Invalid dateOfBirth',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    if (parsed.getTime() > Date.now()) {
      throw new BusinessError(
        'dateOfBirth cannot be in the future',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
    const min = new Date();
    min.setUTCFullYear(min.getUTCFullYear() - 120);
    if (parsed < min) {
      throw new BusinessError(
        'dateOfBirth is unrealistically old',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }

  private assertHeight(heightValue?: number | null): void {
    if (heightValue === undefined || heightValue === null) {
      return;
    }
    if (heightValue <= 0 || heightValue > 300) {
      throw new BusinessError(
        'heightValue must be between 0 and 300',
        ErrorCodes.VALIDATION_ERROR,
        400,
      );
    }
  }
}
