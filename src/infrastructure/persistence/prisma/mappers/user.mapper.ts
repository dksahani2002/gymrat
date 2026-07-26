import { Role as PrismaRole, User as PrismaUser, UserStatus as PrismaStatus } from '@prisma/client';
import { Role, UserStatus } from '../../../../domain/identity/role.enum';
import { User } from '../../../../domain/identity/user.entity';

type UserWithProfile = PrismaUser & {
  profile?: { displayName: string | null } | null;
};

/**
 * Maps Prisma user rows to the domain User entity.
 */
export class UserMapper {
  static toDomain(row: UserWithProfile): User {
    return User.create({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      googleSub: row.googleSub,
      role: row.role as Role,
      status: row.status as UserStatus,
      emailVerifiedAt: row.emailVerifiedAt,
      lastLoginAt: row.lastLoginAt,
      displayName: row.profile?.displayName ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  static toPrismaRole(role: Role): PrismaRole {
    return role as PrismaRole;
  }

  static toPrismaStatus(status: UserStatus): PrismaStatus {
    return status as PrismaStatus;
  }
}
