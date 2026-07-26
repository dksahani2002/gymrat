import { createHash, randomBytes, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  IssueTokenPairInput,
  TokenPair,
  TokenService,
} from '../../../application/identity/ports/token-service.port';
import { REFRESH_TOKEN_REPOSITORY } from '../../../domain/identity/repositories/refresh-token.repository';
import type { RefreshTokenRepository } from '../../../domain/identity/repositories/refresh-token.repository';
import { Inject } from '@nestjs/common';

/**
 * Issues JWT access tokens and opaque rotating refresh tokens.
 */
@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  generateOpaqueToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async issueTokenPair(input: IssueTokenPairInput): Promise<TokenPair> {
    const jti = randomUUID();
    const accessExpiresIn = this.configService.get<string>(
      'auth.accessExpiresIn',
      '15m',
    );
    const refreshExpiresDays = this.configService.get<number>(
      'auth.refreshExpiresDays',
      30,
    );
    const familyId = input.familyId ?? randomUUID();

    const accessToken = await this.jwtService.signAsync(
      {
        sub: input.userId,
        email: input.email,
        role: input.role,
        jti,
      },
      {
        secret: this.configService.getOrThrow<string>('auth.accessSecret'),
        expiresIn: accessExpiresIn,
      },
    );

    const rawRefresh = this.generateOpaqueToken();
    const refreshTokenExpiresAt = new Date(
      Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000,
    );

    await this.refreshTokenRepository.create({
      userId: input.userId,
      tokenHash: this.hashToken(rawRefresh),
      familyId,
      expiresAt: refreshTokenExpiresAt,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      accessTokenExpiresIn: accessExpiresIn,
      refreshTokenExpiresAt,
      familyId,
    };
  }
}
