import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_PORT } from './ports/audit-log.port';
import type { AuditLogPort } from './ports/audit-log.port';
import { GOOGLE_AUTH_PORT } from './ports/google-auth.port';
import type { GoogleAuthPort } from './ports/google-auth.port';
import { MAIL_PORT } from './ports/mail.port';
import type { MailPort } from './ports/mail.port';
import { PASSWORD_HASHER } from './ports/password-hasher.port';
import type { PasswordHasher } from './ports/password-hasher.port';
import { TOKEN_SERVICE } from './ports/token-service.port';
import type { TokenService } from './ports/token-service.port';
import { USER_REPOSITORY } from '../../domain/identity/repositories/user.repository';
import type { UserRepository } from '../../domain/identity/repositories/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/identity/repositories/refresh-token.repository';
import type { RefreshTokenRepository } from '../../domain/identity/repositories/refresh-token.repository';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../../domain/identity/repositories/password-reset-token.repository';
import type { PasswordResetTokenRepository } from '../../domain/identity/repositories/password-reset-token.repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import type { EventBusPort } from '../../shared/events/event-bus.port';
import { User } from '../../domain/identity/user.entity';
import { UserStatus } from '../../domain/identity/role.enum';
import {
  PasswordResetRequestedEvent,
  RefreshTokenReuseDetectedEvent,
  RefreshTokenRotatedEvent,
  UserLoggedInEvent,
  UserRegisteredEvent,
} from '../../domain/identity/events/identity.events';
import {
  AuthenticationError,
  BusinessError,
  ConflictError,
} from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';
import { RATE_LIMITER_PORT } from './ports/rate-limiter.port';
import type { RateLimiterPort } from './ports/rate-limiter.port';
import {
  AuthResult,
  AuthUserView,
  ForgotPasswordCommand,
  GoogleLoginCommand,
  LoginCommand,
  LogoutCommand,
  RefreshCommand,
  RegisterCommand,
  ResetPasswordCommand,
} from './commands/auth.commands';
/**
 * Application service orchestrating Phase 1 authentication use cases.
 */
@Injectable()
export class AuthApplicationService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokens: PasswordResetTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    @Inject(GOOGLE_AUTH_PORT) private readonly googleAuth: GoogleAuthPort,
    @Inject(AUDIT_LOG_PORT) private readonly audit: AuditLogPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(RATE_LIMITER_PORT) private readonly rateLimiter: RateLimiterPort,
  ) {}

  async register(command: RegisterCommand): Promise<AuthResult> {
    const email = command.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('Email is already registered', ErrorCodes.EMAIL_TAKEN);
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    const user = await this.users.createWithDefaults({
      email,
      passwordHash,
      displayName: command.displayName?.trim() || null,
    });

    const tokens = await this.tokenService.issueTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: command.context.userAgent,
      ip: command.context.ip,
    });

    const registered = new UserRegisteredEvent(user.id, user.email);
    this.events.publish(registered.eventName, registered);
    await this.mail.sendWelcome(user.email, user.displayName);

    await this.audit.record({
      actorId: user.id,
      action: 'auth.register',
      resourceType: 'user',
      resourceId: user.id,
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return this.toAuthResult(user, tokens);
  }

  async login(command: LoginCommand): Promise<AuthResult> {
    const email = command.email.trim().toLowerCase();
    await this.assertLoginNotRateLimited(email, command.context.ip);

    const user = await this.users.findByEmail(email);
    const dummyHash =
      '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const hashToVerify = user?.passwordHash ?? dummyHash;
    const passwordValid = await this.passwordHasher.verify(hashToVerify, command.password);

    if (!user || !user.passwordHash || !passwordValid) {
      await this.audit.record({
        actorId: user?.id ?? null,
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: user?.id ?? null,
        ip: command.context.ip,
        userAgent: command.context.userAgent,
        requestId: command.context.requestId,
        afterJson: { email },
      });
      throw new AuthenticationError('Invalid email or password', ErrorCodes.INVALID_CREDENTIALS);
    }

    this.assertUserCanAuthenticate(user);

    await this.users.touchLastLogin(user.id);
    const tokens = await this.tokenService.issueTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: command.context.userAgent,
      ip: command.context.ip,
    });

    const loggedIn = new UserLoggedInEvent(user.id, command.context.ip ?? null);
    this.events.publish(loggedIn.eventName, loggedIn);

    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return this.toAuthResult(user, tokens);
  }

  async refresh(command: RefreshCommand): Promise<AuthResult> {
    const tokenHash = this.tokenService.hashToken(command.refreshToken);
    const existing = await this.refreshTokens.findByTokenHash(tokenHash);

    if (!existing) {
      throw new AuthenticationError('Invalid refresh token', ErrorCodes.INVALID_TOKEN);
    }

    if (existing.isRevoked) {
      await this.refreshTokens.revokeFamily(existing.familyId);
      const reuse = new RefreshTokenReuseDetectedEvent(existing.userId, existing.familyId);
      this.events.publish(reuse.eventName, reuse);
      await this.audit.record({
        actorId: existing.userId,
        action: 'auth.refresh_reuse_detected',
        resourceType: 'refresh_token_family',
        resourceId: existing.familyId,
        ip: command.context.ip,
        userAgent: command.context.userAgent,
        requestId: command.context.requestId,
      });
      throw new AuthenticationError(
        'Refresh token reuse detected. Please sign in again.',
        ErrorCodes.TOKEN_REUSE_DETECTED,
      );
    }

    if (existing.isExpired) {
      throw new AuthenticationError('Refresh token expired', ErrorCodes.INVALID_TOKEN);
    }

    const user = await this.users.findById(existing.userId);
    if (!user) {
      throw new AuthenticationError('Invalid refresh token', ErrorCodes.INVALID_TOKEN);
    }
    this.assertUserCanAuthenticate(user);

    const tokens = await this.tokenService.issueTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      familyId: existing.familyId,
      userAgent: command.context.userAgent,
      ip: command.context.ip,
    });

    // Find the newly created token id to set replaced_by linkage.
    const newHash = this.tokenService.hashToken(tokens.refreshToken);
    const created = await this.refreshTokens.findByTokenHash(newHash);
    await this.refreshTokens.revoke(existing.id, created?.id);

    const rotated = new RefreshTokenRotatedEvent(user.id, existing.familyId);
    this.events.publish(rotated.eventName, rotated);

    return this.toAuthResult(user, tokens);
  }

  async logout(command: LogoutCommand): Promise<void> {
    if (command.refreshToken) {
      const tokenHash = this.tokenService.hashToken(command.refreshToken);
      const existing = await this.refreshTokens.findByTokenHash(tokenHash);
      if (existing && existing.userId === command.userId) {
        await this.refreshTokens.revokeFamily(existing.familyId);
      }
    } else {
      await this.refreshTokens.revokeAllForUser(command.userId);
    }

    await this.audit.record({
      actorId: command.userId,
      action: 'auth.logout',
      resourceType: 'user',
      resourceId: command.userId,
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });
  }

  async forgotPassword(command: ForgotPasswordCommand): Promise<void> {
    const email = command.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (user && user.isActive) {
      await this.passwordResetTokens.invalidateAllForUser(user.id);
      const rawToken = this.tokenService.generateOpaqueToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await this.passwordResetTokens.create(
        user.id,
        this.tokenService.hashToken(rawToken),
        expiresAt,
      );

      const event = new PasswordResetRequestedEvent(user.id, user.email, rawToken);
      this.events.publish(event.eventName, event);
      await this.mail.sendPasswordReset(user.email, rawToken);

      await this.audit.record({
        actorId: user.id,
        action: 'auth.forgot_password',
        resourceType: 'user',
        resourceId: user.id,
        ip: command.context.ip,
        userAgent: command.context.userAgent,
        requestId: command.context.requestId,
      });
    }
  }

  async resetPassword(command: ResetPasswordCommand): Promise<void> {
    const tokenHash = this.tokenService.hashToken(command.token);
    const record = await this.passwordResetTokens.findValidByHash(tokenHash);
    if (!record) {
      throw new AuthenticationError('Invalid or expired reset token', ErrorCodes.INVALID_TOKEN);
    }

    const user = await this.users.findById(record.userId);
    if (!user) {
      throw new AuthenticationError('Invalid or expired reset token', ErrorCodes.INVALID_TOKEN);
    }

    const passwordHash = await this.passwordHasher.hash(command.newPassword);
    await this.users.updatePasswordHash(user.id, passwordHash);
    await this.passwordResetTokens.markUsed(record.id);
    await this.refreshTokens.revokeAllForUser(user.id);

    await this.audit.record({
      actorId: user.id,
      action: 'auth.reset_password',
      resourceType: 'user',
      resourceId: user.id,
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });
  }

  async googleLogin(command: GoogleLoginCommand): Promise<AuthResult> {
    const identity = await this.googleAuth.verifyIdToken(command.idToken);
    if (!identity.emailVerified) {
      throw new AuthenticationError(
        'Google email is not verified',
        ErrorCodes.AUTHENTICATION_ERROR,
      );
    }

    const email = identity.email.toLowerCase();
    let user = await this.users.findByGoogleSub(identity.sub);

    if (!user) {
      const byEmail = await this.users.findByEmail(email);
      if (byEmail) {
        user = await this.users.linkGoogleSub(byEmail.id, identity.sub);
      } else {
        user = await this.users.createWithDefaults({
          email,
          passwordHash: null,
          googleSub: identity.sub,
          displayName: identity.name ?? null,
          emailVerifiedAt: new Date(),
        });
      }
    }

    this.assertUserCanAuthenticate(user);
    await this.users.touchLastLogin(user.id);

    const tokens = await this.tokenService.issueTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: command.context.userAgent,
      ip: command.context.ip,
    });

    await this.audit.record({
      actorId: user.id,
      action: 'auth.google_login',
      resourceType: 'user',
      resourceId: user.id,
      ip: command.context.ip,
      userAgent: command.context.userAgent,
      requestId: command.context.requestId,
    });

    return this.toAuthResult(user, tokens);
  }

  async me(userId: string): Promise<AuthUserView> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found', ErrorCodes.INVALID_TOKEN);
    }
    return this.toUserView(user);
  }

  private assertUserCanAuthenticate(user: User): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new AuthenticationError('Account is suspended', ErrorCodes.ACCOUNT_SUSPENDED);
    }
    if (user.status === UserStatus.DELETED || user.deletedAt !== null) {
      throw new AuthenticationError('Account is deleted', ErrorCodes.ACCOUNT_DELETED);
    }
  }

  private async assertLoginNotRateLimited(email: string, ip?: string | null): Promise<void> {
    const windowSeconds = 60;
    const limit = 10;
    const keys = [
      `auth:login:email:${email}`,
      ip ? `auth:login:ip:${ip}` : null,
    ].filter((key): key is string => Boolean(key));

    for (const key of keys) {
      const allowed = await this.rateLimiter.hit(key, limit, windowSeconds);
      if (!allowed) {
        throw new BusinessError(
          'Too many login attempts. Try again later.',
          ErrorCodes.RATE_LIMITED,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private toUserView(user: User): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  private toAuthResult(
    user: User,
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresIn: string;
      refreshTokenExpiresAt: Date;
    },
  ): AuthResult {
    return {
      user: this.toUserView(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresIn: tokens.accessTokenExpiresIn,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    };
  }
}
