import { Entity } from '../common/entity.base';
import { Role, UserStatus } from './role.enum';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string | null;
  googleSub: string | null;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  displayName?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Identity aggregate root representing an authenticated account.
 */
export class User extends Entity {
  readonly email: string;
  readonly passwordHash: string | null;
  readonly googleSub: string | null;
  readonly role: Role;
  readonly status: UserStatus;
  readonly emailVerifiedAt: Date | null;
  readonly lastLoginAt: Date | null;
  readonly displayName: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: UserProps) {
    super(props.id);
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.googleSub = props.googleSub;
    this.role = props.role;
    this.status = props.status;
    this.emailVerifiedAt = props.emailVerifiedAt;
    this.lastLoginAt = props.lastLoginAt;
    this.displayName = props.displayName ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: UserProps): User {
    return new User(props);
  }

  get isActive(): boolean {
    return this.status === UserStatus.ACTIVE && this.deletedAt === null;
  }

  assertCanAuthenticate(): void {
    if (this.status === UserStatus.SUSPENDED) {
      throw new Error('ACCOUNT_SUSPENDED');
    }
    if (this.status === UserStatus.DELETED || this.deletedAt !== null) {
      throw new Error('ACCOUNT_DELETED');
    }
  }
}
