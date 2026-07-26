import { Entity } from '../common/entity.base';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  HeightUnit,
  WeightUnit,
} from './profile.enums';

export interface UserProfileProps {
  id: string;
  userId: string;
  email: string;
  role: string;
  displayName: string | null;
  dateOfBirth: Date | null;
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

/**
 * Read model / aggregate view for the authenticated user's profile.
 */
export class UserProfile extends Entity {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly displayName: string | null;
  readonly dateOfBirth: Date | null;
  readonly gender: Gender | null;
  readonly heightValue: number | null;
  readonly heightUnit: HeightUnit;
  readonly fitnessGoal: FitnessGoal | null;
  readonly activityLevel: ActivityLevel | null;
  readonly preferredWeightUnit: WeightUnit;
  readonly timezone: string;
  readonly emailVerifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProfileProps) {
    super(props.id);
    this.userId = props.userId;
    this.email = props.email;
    this.role = props.role;
    this.displayName = props.displayName;
    this.dateOfBirth = props.dateOfBirth;
    this.gender = props.gender;
    this.heightValue = props.heightValue;
    this.heightUnit = props.heightUnit;
    this.fitnessGoal = props.fitnessGoal;
    this.activityLevel = props.activityLevel;
    this.preferredWeightUnit = props.preferredWeightUnit;
    this.timezone = props.timezone;
    this.emailVerifiedAt = props.emailVerifiedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: UserProfileProps): UserProfile {
    return new UserProfile(props);
  }

  /**
   * Approximate age from date of birth (UTC year difference).
   */
  get age(): number | null {
    if (!this.dateOfBirth) {
      return null;
    }
    const today = new Date();
    let years = today.getUTCFullYear() - this.dateOfBirth.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - this.dateOfBirth.getUTCMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getUTCDate() < this.dateOfBirth.getUTCDate())
    ) {
      years -= 1;
    }
    return years;
  }
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  workoutReminders: boolean;
  prAlerts: boolean;
  weeklySummary: boolean;
}

export interface UserPreferences {
  preferredWeightUnit: WeightUnit;
  heightUnit: HeightUnit;
  timezone: string;
  notifications: NotificationPreferences;
}
