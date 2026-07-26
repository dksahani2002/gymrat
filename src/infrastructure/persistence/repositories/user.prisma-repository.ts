import { Injectable } from '@nestjs/common';
import { User } from '../../../domain/identity/user.entity';
import {
  CreateUserInput,
  UserRepository,
} from '../../../domain/identity/repositories/user.repository';
import { RepositoryError } from '../../../shared/errors/base.error';
import { PrismaService } from '../prisma/prisma.service';
import { UserMapper } from '../prisma/mappers/user.mapper';

@Injectable()
export class UserPrismaRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { profile: true },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        deletedAt: null,
      },
      include: { profile: true },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { googleSub, deletedAt: null },
      include: { profile: true },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async createWithDefaults(input: CreateUserInput): Promise<User> {
    try {
      const row = await this.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          googleSub: input.googleSub ?? null,
          emailVerifiedAt: input.emailVerifiedAt ?? null,
          profile: {
            create: {
              displayName: input.displayName ?? null,
            },
          },
          notificationPreferences: {
            create: {},
          },
        },
        include: { profile: true },
      });
      return UserMapper.toDomain(row);
    } catch (error) {
      throw new RepositoryError('Failed to create user', error);
    }
  }

  async linkGoogleSub(userId: string, googleSub: string): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleSub,
        emailVerifiedAt: new Date(),
      },
      include: { profile: true },
    });
    return UserMapper.toDomain(row);
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
