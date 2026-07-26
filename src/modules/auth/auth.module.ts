import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthApplicationService } from '../../application/identity/auth.application-service';
import { AUDIT_LOG_PORT } from '../../application/identity/ports/audit-log.port';
import { GOOGLE_AUTH_PORT } from '../../application/identity/ports/google-auth.port';
import { MAIL_PORT } from '../../application/identity/ports/mail.port';
import { PASSWORD_HASHER } from '../../application/identity/ports/password-hasher.port';
import { TOKEN_SERVICE } from '../../application/identity/ports/token-service.port';
import { RATE_LIMITER_PORT } from '../../application/identity/ports/rate-limiter.port';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../../domain/identity/repositories/password-reset-token.repository';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/identity/repositories/refresh-token.repository';
import { USER_REPOSITORY } from '../../domain/identity/repositories/user.repository';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { GoogleAuthService } from '../../infrastructure/auth/google-oauth/google-auth.service';
import { JwtTokenService } from '../../infrastructure/auth/jwt/jwt-token.service';
import { Argon2PasswordHasher } from '../../infrastructure/auth/password/argon2-password.hasher';
import { RedisRateLimiter } from '../../infrastructure/cache/redis-rate-limiter';
import { NestEventBus } from '../../infrastructure/events/nest-event-bus';
import { LoggingMailService } from '../../infrastructure/mail/logging-mail.service';
import { PasswordResetTokenPrismaRepository } from '../../infrastructure/persistence/repositories/password-reset-token.prisma-repository';
import { RefreshTokenPrismaRepository } from '../../infrastructure/persistence/repositories/refresh-token.prisma-repository';
import { UserPrismaRepository } from '../../infrastructure/persistence/repositories/user.prisma-repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.accessSecret'),
        signOptions: {
          expiresIn: config.get<string>('auth.accessExpiresIn', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthApplicationService,
    JwtStrategy,
    { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenPrismaRepository },
    {
      provide: PASSWORD_RESET_TOKEN_REPOSITORY,
      useClass: PasswordResetTokenPrismaRepository,
    },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: MAIL_PORT, useClass: LoggingMailService },
    { provide: GOOGLE_AUTH_PORT, useClass: GoogleAuthService },
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
    { provide: EVENT_BUS, useClass: NestEventBus },
    { provide: RATE_LIMITER_PORT, useClass: RedisRateLimiter },
  ],
  exports: [AuthApplicationService, JwtModule, PassportModule],
})
export class AuthModule {}
