export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol(
  'PASSWORD_RESET_TOKEN_REPOSITORY',
);

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Port for one-time password reset tokens.
 */
export interface PasswordResetTokenRepository {
  create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<PasswordResetTokenRecord>;
  findValidByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(id: string): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
}
