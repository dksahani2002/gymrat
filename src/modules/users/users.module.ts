import { Module } from '@nestjs/common';
import { ProfileApplicationService } from '../../application/profile/profile.application-service';
import { AUDIT_LOG_PORT } from '../../application/identity/ports/audit-log.port';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/identity/repositories/refresh-token.repository';
import { PROFILE_REPOSITORY } from '../../domain/profile/repositories/profile.repository';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { NestEventBus } from '../../infrastructure/events/nest-event-bus';
import { ProfilePrismaRepository } from '../../infrastructure/persistence/repositories/profile.prisma-repository';
import { RefreshTokenPrismaRepository } from '../../infrastructure/persistence/repositories/refresh-token.prisma-repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    ProfileApplicationService,
    { provide: PROFILE_REPOSITORY, useClass: ProfilePrismaRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenPrismaRepository },
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
    { provide: EVENT_BUS, useClass: NestEventBus },
  ],
  exports: [ProfileApplicationService],
})
export class UsersModule {}
