import { Module } from '@nestjs/common';
import { BodyWeightApplicationService } from '../../application/body-weight/body-weight.application-service';
import { AUDIT_LOG_PORT } from '../../application/identity/ports/audit-log.port';
import { BODY_WEIGHT_REPOSITORY } from '../../domain/body-weight/repositories/body-weight.repository';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { NestEventBus } from '../../infrastructure/events/nest-event-bus';
import { BodyWeightPrismaRepository } from '../../infrastructure/persistence/repositories/body-weight.prisma-repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { BodyWeightController } from './body-weight.controller';

@Module({
  controllers: [BodyWeightController],
  providers: [
    BodyWeightApplicationService,
    { provide: BODY_WEIGHT_REPOSITORY, useClass: BodyWeightPrismaRepository },
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
    { provide: EVENT_BUS, useClass: NestEventBus },
  ],
  exports: [BodyWeightApplicationService, BODY_WEIGHT_REPOSITORY],
})
export class BodyWeightModule {}
