import { User } from '../user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface CreateUserInput {
  email: string;
  passwordHash: string | null;
  googleSub?: string | null;
  displayName?: string | null;
  emailVerifiedAt?: Date | null;
}

/**
 * Port for user persistence.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleSub(googleSub: string): Promise<User | null>;
  createWithDefaults(input: CreateUserInput): Promise<User>;
  linkGoogleSub(userId: string, googleSub: string): Promise<User>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  touchLastLogin(userId: string): Promise<void>;
}
