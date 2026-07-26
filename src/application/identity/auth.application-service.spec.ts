import { HttpStatus } from '@nestjs/common';
import { AuthApplicationService } from './auth.application-service';
import { Role, UserStatus } from '../../domain/identity/role.enum';
import { User } from '../../domain/identity/user.entity';
import { RefreshToken } from '../../domain/identity/refresh-token.entity';
import { ErrorCodes } from '../../shared/errors/error-codes';
import { AuthenticationError, BusinessError, ConflictError } from '../../shared/errors/base.error';

describe('AuthApplicationService', () => {
  const context = { ip: '127.0.0.1', userAgent: 'jest', requestId: 'req-1' };

  const users = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByGoogleSub: jest.fn(),
    createWithDefaults: jest.fn(),
    linkGoogleSub: jest.fn(),
    updatePasswordHash: jest.fn(),
    touchLastLogin: jest.fn(),
  };

  const refreshTokens = {
    create: jest.fn(),
    findByTokenHash: jest.fn(),
    revoke: jest.fn(),
    revokeFamily: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const passwordResetTokens = {
    create: jest.fn(),
    findValidByHash: jest.fn(),
    markUsed: jest.fn(),
    invalidateAllForUser: jest.fn(),
  };

  const passwordHasher = {
    hash: jest.fn(),
    verify: jest.fn(),
  };

  const tokenService = {
    issueTokenPair: jest.fn(),
    hashToken: jest.fn((token: string) => `hash:${token}`),
    generateOpaqueToken: jest.fn(() => 'opaque-reset-token-value-123456'),
  };

  const mail = {
    sendPasswordReset: jest.fn(),
    sendWelcome: jest.fn(),
  };

  const googleAuth = {
    verifyIdToken: jest.fn(),
  };

  const audit = {
    record: jest.fn(),
  };

  const events = {
    publish: jest.fn(),
  };

  const rateLimiter = {
    hit: jest.fn().mockResolvedValue(true),
  };

  let service: AuthApplicationService;

  const sampleUser = User.create({
    id: 'user-1',
    email: 'athlete@gymrat.app',
    passwordHash: 'hashed',
    googleSub: null,
    role: Role.USER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    lastLoginAt: null,
    displayName: 'Alex',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  });

  const sampleTokens = {
    accessToken: 'access',
    refreshToken: 'refresh-raw',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresAt: new Date('2026-08-01'),
    familyId: 'family-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimiter.hit.mockResolvedValue(true);
    service = new AuthApplicationService(
      users as never,
      refreshTokens as never,
      passwordResetTokens as never,
      passwordHasher as never,
      tokenService as never,
      mail as never,
      googleAuth as never,
      audit as never,
      events as never,
      rateLimiter as never,
    );
  });

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwordHasher.hash.mockResolvedValue('hashed');
      users.createWithDefaults.mockResolvedValue(sampleUser);
      tokenService.issueTokenPair.mockResolvedValue(sampleTokens);

      const result = await service.register({
        email: 'Athlete@GymRat.app',
        password: 'Str0ngPass!',
        displayName: 'Alex',
        context,
      });

      expect(users.createWithDefaults).toHaveBeenCalledWith({
        email: 'athlete@gymrat.app',
        passwordHash: 'hashed',
        displayName: 'Alex',
      });
      expect(mail.sendWelcome).toHaveBeenCalled();
      expect(result.accessToken).toBe('access');
      expect(result.user.email).toBe('athlete@gymrat.app');
    });

    it('rejects duplicate emails', async () => {
      users.findByEmail.mockResolvedValue(sampleUser);

      await expect(
        service.register({
          email: 'athlete@gymrat.app',
          password: 'Str0ngPass!',
          context,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('login', () => {
    it('authenticates with valid credentials', async () => {
      users.findByEmail.mockResolvedValue(sampleUser);
      passwordHasher.verify.mockResolvedValue(true);
      tokenService.issueTokenPair.mockResolvedValue(sampleTokens);

      const result = await service.login({
        email: 'athlete@gymrat.app',
        password: 'Str0ngPass!',
        context,
      });

      expect(users.touchLastLogin).toHaveBeenCalledWith('user-1');
      expect(result.refreshToken).toBe('refresh-raw');
    });

    it('rejects invalid credentials', async () => {
      users.findByEmail.mockResolvedValue(sampleUser);
      passwordHasher.verify.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'athlete@gymrat.app',
          password: 'wrong',
          context,
        }),
      ).rejects.toMatchObject({ code: ErrorCodes.INVALID_CREDENTIALS });
    });

    it('rate limits excessive attempts', async () => {
      rateLimiter.hit.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'athlete@gymrat.app',
          password: 'Str0ngPass!',
          context,
        }),
      ).rejects.toBeInstanceOf(BusinessError);
    });
  });

  describe('refresh', () => {
    it('rotates a valid refresh token', async () => {
      const existing = RefreshToken.create({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'hash:old',
        familyId: 'family-1',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedById: null,
        userAgent: null,
        ip: null,
        createdAt: new Date(),
      });
      const created = RefreshToken.create({
        ...existing,
        id: 'rt-2',
        tokenHash: 'hash:refresh-raw',
      });

      refreshTokens.findByTokenHash
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(created);
      users.findById.mockResolvedValue(sampleUser);
      tokenService.issueTokenPair.mockResolvedValue(sampleTokens);

      const result = await service.refresh({
        refreshToken: 'old',
        context,
      });

      expect(refreshTokens.revoke).toHaveBeenCalledWith('rt-1', 'rt-2');
      expect(result.accessToken).toBe('access');
    });

    it('detects reuse and revokes the family', async () => {
      const revoked = RefreshToken.create({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'hash:old',
        familyId: 'family-1',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        replacedById: 'rt-2',
        userAgent: null,
        ip: null,
        createdAt: new Date(),
      });
      refreshTokens.findByTokenHash.mockResolvedValue(revoked);

      await expect(
        service.refresh({ refreshToken: 'old', context }),
      ).rejects.toMatchObject({ code: ErrorCodes.TOKEN_REUSE_DETECTED });
      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-1');
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('always succeeds for unknown emails without leaking existence', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'missing@gymrat.app', context }),
      ).resolves.toBeUndefined();
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('resets password and revokes sessions', async () => {
      passwordResetTokens.findValidByHash.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        tokenHash: 'hash:token',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      users.findById.mockResolvedValue(sampleUser);
      passwordHasher.hash.mockResolvedValue('new-hash');

      await service.resetPassword({
        token: 'token',
        newPassword: 'N3wStr0ngPass!',
        context,
      });

      expect(users.updatePasswordHash).toHaveBeenCalledWith('user-1', 'new-hash');
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
      expect(passwordResetTokens.markUsed).toHaveBeenCalledWith('prt-1');
    });
  });

  describe('googleLogin', () => {
    it('creates a new user from a verified Google identity', async () => {
      googleAuth.verifyIdToken.mockResolvedValue({
        sub: 'google-sub',
        email: 'athlete@gymrat.app',
        emailVerified: true,
        name: 'Alex',
      });
      users.findByGoogleSub.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(null);
      users.createWithDefaults.mockResolvedValue(sampleUser);
      tokenService.issueTokenPair.mockResolvedValue(sampleTokens);

      const result = await service.googleLogin({
        idToken: 'google-id-token',
        context,
      });

      expect(users.createWithDefaults).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'athlete@gymrat.app',
          googleSub: 'google-sub',
          passwordHash: null,
        }),
      );
      expect(result.user.id).toBe('user-1');
    });

    it('rejects unverified Google emails', async () => {
      googleAuth.verifyIdToken.mockResolvedValue({
        sub: 'google-sub',
        email: 'athlete@gymrat.app',
        emailVerified: false,
      });

      await expect(
        service.googleLogin({ idToken: 'google-id-token', context }),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });
  });

  describe('logout', () => {
    it('revokes a refresh family when token provided', async () => {
      refreshTokens.findByTokenHash.mockResolvedValue(
        RefreshToken.create({
          id: 'rt-1',
          userId: 'user-1',
          tokenHash: 'hash:refresh',
          familyId: 'family-1',
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          replacedById: null,
          userAgent: null,
          ip: null,
          createdAt: new Date(),
        }),
      );

      await service.logout({
        userId: 'user-1',
        refreshToken: 'refresh',
        context,
      });

      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-1');
    });
  });

  it('exposes http status mapping for rate limits', () => {
    const error = new BusinessError(
      'Too many',
      ErrorCodes.RATE_LIMITED,
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(error.httpStatus).toBe(429);
  });
});
