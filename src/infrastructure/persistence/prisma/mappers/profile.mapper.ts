import {
  ActivityLevel as PrismaActivityLevel,
  FitnessGoal as PrismaFitnessGoal,
  Gender as PrismaGender,
  HeightUnit as PrismaHeightUnit,
  Prisma,
  UserStatus,
  WeightUnit as PrismaWeightUnit,
} from '@prisma/client';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  HeightUnit,
  WeightUnit,
} from '../../../../domain/profile/profile.enums';
import { UserProfile } from '../../../../domain/profile/user-profile.entity';

type ProfileRow = {
  id: string;
  userId: string;
  displayName: string | null;
  dateOfBirth: Date | null;
  gender: PrismaGender | null;
  heightValue: Prisma.Decimal | null;
  heightUnit: PrismaHeightUnit;
  fitnessGoal: PrismaFitnessGoal | null;
  activityLevel: PrismaActivityLevel | null;
  preferredWeightUnit: PrismaWeightUnit;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    email: string;
    role: string;
    emailVerifiedAt: Date | null;
    status: UserStatus;
    deletedAt: Date | null;
  };
};

/**
 * Maps Prisma profile rows to the domain UserProfile entity.
 */
export class ProfileMapper {
  static toDomain(row: ProfileRow): UserProfile {
    return UserProfile.create({
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      role: row.user.role,
      displayName: row.displayName,
      dateOfBirth: row.dateOfBirth,
      gender: (row.gender as Gender | null) ?? null,
      heightValue: row.heightValue ? Number(row.heightValue) : null,
      heightUnit: row.heightUnit as HeightUnit,
      fitnessGoal: (row.fitnessGoal as FitnessGoal | null) ?? null,
      activityLevel: (row.activityLevel as ActivityLevel | null) ?? null,
      preferredWeightUnit: row.preferredWeightUnit as WeightUnit,
      timezone: row.timezone,
      emailVerifiedAt: row.user.emailVerifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
