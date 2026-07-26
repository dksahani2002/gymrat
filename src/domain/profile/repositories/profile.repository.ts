import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  HeightUnit,
  WeightUnit,
} from '../profile.enums';
import {
  NotificationPreferences,
  UserPreferences,
  UserProfile,
} from '../user-profile.entity';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface UpdateProfileInput {
  displayName?: string | null;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  heightValue?: number | null;
  heightUnit?: HeightUnit;
  fitnessGoal?: FitnessGoal | null;
  activityLevel?: ActivityLevel | null;
  preferredWeightUnit?: WeightUnit;
  timezone?: string;
}

export interface UpdatePreferencesInput {
  preferredWeightUnit?: WeightUnit;
  heightUnit?: HeightUnit;
  timezone?: string;
  notifications?: Partial<NotificationPreferences>;
}

/**
 * Port for profile and preference persistence.
 */
export interface ProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
  getPreferences(userId: string): Promise<UserPreferences | null>;
  updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<UserPreferences>;
  softDeleteAccount(userId: string): Promise<void>;
}
