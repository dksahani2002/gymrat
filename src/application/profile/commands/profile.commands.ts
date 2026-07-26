import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  HeightUnit,
  WeightUnit,
} from '../../../domain/profile/profile.enums';

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface ProfileView {
  id: string;
  userId: string;
  email: string;
  role: string;
  displayName: string | null;
  dateOfBirth: string | null;
  age: number | null;
  gender: Gender | null;
  heightValue: number | null;
  heightUnit: HeightUnit;
  fitnessGoal: FitnessGoal | null;
  activityLevel: ActivityLevel | null;
  preferredWeightUnit: WeightUnit;
  timezone: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreferencesView {
  preferredWeightUnit: WeightUnit;
  heightUnit: HeightUnit;
  timezone: string;
  notifications: {
    emailEnabled: boolean;
    pushEnabled: boolean;
    workoutReminders: boolean;
    prAlerts: boolean;
    weeklySummary: boolean;
  };
}

export interface UpdateProfileCommand {
  userId: string;
  displayName?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  heightValue?: number | null;
  heightUnit?: HeightUnit;
  fitnessGoal?: FitnessGoal | null;
  activityLevel?: ActivityLevel | null;
  preferredWeightUnit?: WeightUnit;
  timezone?: string;
  context: RequestContext;
}

export interface UpdatePreferencesCommand {
  userId: string;
  preferredWeightUnit?: WeightUnit;
  heightUnit?: HeightUnit;
  timezone?: string;
  notifications?: Partial<PreferencesView['notifications']>;
  context: RequestContext;
}

export interface DeleteAccountCommand {
  userId: string;
  context: RequestContext;
}
