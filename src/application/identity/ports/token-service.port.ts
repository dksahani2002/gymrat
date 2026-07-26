import { Role } from '../../../domain/identity/role.enum';

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresAt: Date;
  familyId: string;
}

export interface IssueTokenPairInput {
  userId: string;
  email: string;
  role: Role;
  familyId?: string;
  userAgent?: string | null;
  ip?: string | null;
}

/**
 * Port for issuing and hashing auth tokens.
 */
export interface TokenService {
  issueTokenPair(input: IssueTokenPairInput): Promise<TokenPair>;
  hashToken(rawToken: string): string;
  generateOpaqueToken(): string;
}
