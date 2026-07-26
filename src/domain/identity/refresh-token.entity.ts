import { Entity } from '../common/entity.base';

export interface RefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
}

/**
 * Opaque refresh token persistence model (hash only; raw token never stored).
 */
export class RefreshToken extends Entity {
  readonly userId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly replacedById: string | null;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly createdAt: Date;

  private constructor(props: RefreshTokenProps) {
    super(props.id);
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.familyId = props.familyId;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.replacedById = props.replacedById;
    this.userAgent = props.userAgent;
    this.ip = props.ip;
    this.createdAt = props.createdAt;
  }

  static create(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken(props);
  }

  get isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  get isExpired(): boolean {
    return this.expiresAt.getTime() <= Date.now();
  }

  get isUsable(): boolean {
    return !this.isRevoked && !this.isExpired;
  }
}
