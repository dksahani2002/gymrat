import { Injectable } from '@nestjs/common';
import {
  ActivityLevel as PrismaActivityLevel,
  FitnessGoal as PrismaFitnessGoal,
  Gender as PrismaGender,
  HeightUnit as PrismaHeightUnit,
  WeightUnit as PrismaWeightUnit,
  UserStatus,
} from '@prisma/client';
import {
  ProfileRepository,
  UpdatePreferencesInput,
  UpdateProfileInput,
} from '../../../domain/profile/repositories/profile.repository';
import {
  UserPreferences,
  UserProfile,
} from '../../../domain/profile/user-profile.entity';
import { HeightUnit, WeightUnit } from '../../../domain/profile/profile.enums';
import { RepositoryError } from '../../../shared/errors/base.error';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileMapper } from '../prisma/mappers/profile.mapper';

@Injectable()
export class ProfilePrismaRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const row = await this.prisma.userProfile.findFirst({
      where: {
        userId,
        user: { deletedAt: null, status: { not: UserStatus.DELETED } },
      },
      include: {
        user: {
          select: {
            email: true,
            role: true,
            emailVerifiedAt: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });
    return row ? ProfileMapper.toDomain(row) : null;
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserProfile> {
    try {
      const data: {
        displayName?: string | null;
        dateOfBirth?: Date | null;
        gender?: PrismaGender | null;
        heightValue?: number | null;
        heightUnit?: PrismaHeightUnit;
        fitnessGoal?: PrismaFitnessGoal | null;
        activityLevel?: PrismaActivityLevel | null;
        preferredWeightUnit?: PrismaWeightUnit;
        timezone?: string;
      } = {};

      if (input.displayName !== undefined) data.displayName = input.displayName;
      if (input.dateOfBirth !== undefined) data.dateOfBirth = input.dateOfBirth;
      if (input.gender !== undefined)
        data.gender = input.gender as PrismaGender | null;
      if (input.heightValue !== undefined) data.heightValue = input.heightValue;
      if (input.heightUnit !== undefined) {
        data.heightUnit = input.heightUnit as PrismaHeightUnit;
      }
      if (input.fitnessGoal !== undefined) {
        data.fitnessGoal = input.fitnessGoal as PrismaFitnessGoal | null;
      }
      if (input.activityLevel !== undefined) {
        data.activityLevel = input.activityLevel as PrismaActivityLevel | null;
      }
      if (input.preferredWeightUnit !== undefined) {
        data.preferredWeightUnit =
          input.preferredWeightUnit as PrismaWeightUnit;
      }
      if (input.timezone !== undefined) data.timezone = input.timezone;

      const row = await this.prisma.userProfile.update({
        where: { userId },
        data,
        include: {
          user: {
            select: {
              email: true,
              role: true,
              emailVerifiedAt: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      });
      return ProfileMapper.toDomain(row);
    } catch (error) {
      throw new RepositoryError('Failed to update profile', error);
    }
  }

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const profile = await this.prisma.userProfile.findFirst({
      where: {
        userId,
        user: { deletedAt: null, status: { not: UserStatus.DELETED } },
      },
    });
    if (!profile) {
      return null;
    }

    let notifications = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!notifications) {
      notifications = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }

    return {
      preferredWeightUnit: profile.preferredWeightUnit as WeightUnit,
      heightUnit: profile.heightUnit as HeightUnit,
      timezone: profile.timezone,
      notifications: {
        emailEnabled: notifications.emailEnabled,
        pushEnabled: notifications.pushEnabled,
        workoutReminders: notifications.workoutReminders,
        prAlerts: notifications.prAlerts,
        weeklySummary: notifications.weeklySummary,
      },
    };
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<UserPreferences> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const profileData: {
          preferredWeightUnit?: PrismaWeightUnit;
          heightUnit?: PrismaHeightUnit;
          timezone?: string;
        } = {};
        if (input.preferredWeightUnit !== undefined) {
          profileData.preferredWeightUnit =
            input.preferredWeightUnit as PrismaWeightUnit;
        }
        if (input.heightUnit !== undefined) {
          profileData.heightUnit = input.heightUnit as PrismaHeightUnit;
        }
        if (input.timezone !== undefined) {
          profileData.timezone = input.timezone;
        }
        if (Object.keys(profileData).length > 0) {
          await tx.userProfile.update({
            where: { userId },
            data: profileData,
          });
        }

        if (input.notifications) {
          await tx.notificationPreference.upsert({
            where: { userId },
            create: {
              userId,
              emailEnabled: input.notifications.emailEnabled ?? true,
              pushEnabled: input.notifications.pushEnabled ?? true,
              workoutReminders: input.notifications.workoutReminders ?? true,
              prAlerts: input.notifications.prAlerts ?? true,
              weeklySummary: input.notifications.weeklySummary ?? true,
            },
            update: {
              ...(input.notifications.emailEnabled !== undefined
                ? { emailEnabled: input.notifications.emailEnabled }
                : {}),
              ...(input.notifications.pushEnabled !== undefined
                ? { pushEnabled: input.notifications.pushEnabled }
                : {}),
              ...(input.notifications.workoutReminders !== undefined
                ? { workoutReminders: input.notifications.workoutReminders }
                : {}),
              ...(input.notifications.prAlerts !== undefined
                ? { prAlerts: input.notifications.prAlerts }
                : {}),
              ...(input.notifications.weeklySummary !== undefined
                ? { weeklySummary: input.notifications.weeklySummary }
                : {}),
            },
          });
        }
      });

      const prefs = await this.getPreferences(userId);
      if (!prefs) {
        throw new RepositoryError('Preferences missing after update');
      }
      return prefs;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError('Failed to update preferences', error);
    }
  }

  async softDeleteAccount(userId: string): Promise<void> {
    try {
      const anonymizedEmail = `deleted+${userId}@deleted.local`;
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            status: UserStatus.DELETED,
            deletedAt: new Date(),
            email: anonymizedEmail,
            passwordHash: null,
            googleSub: null,
            emailVerifiedAt: null,
          },
        });
        await tx.userProfile.update({
          where: { userId },
          data: {
            displayName: null,
            dateOfBirth: null,
            gender: null,
            heightValue: null,
            fitnessGoal: null,
            activityLevel: null,
          },
        });
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    } catch (error) {
      throw new RepositoryError('Failed to soft-delete account', error);
    }
  }
}
