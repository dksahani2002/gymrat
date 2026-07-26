import { Module } from '@nestjs/common';
import { BodyMeasurementApplicationService } from '../../application/body-measurement/body-measurement.application-service';
import { AUDIT_LOG_PORT } from '../../application/identity/ports/audit-log.port';
import { BODY_MEASUREMENT_REPOSITORY } from '../../domain/body-measurement/repositories/body-measurement.repository';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { NestEventBus } from '../../infrastructure/events/nest-event-bus';
import { BodyMeasurementPrismaRepository } from '../../infrastructure/persistence/repositories/body-measurement.prisma-repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { MeasurementsController } from './measurements.controller';

@Module({
  controllers: [MeasurementsController],
  providers: [
    BodyMeasurementApplicationService,
    {
      provide: BODY_MEASUREMENT_REPOSITORY,
      useClass: BodyMeasurementPrismaRepository,
    },
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
    { provide: EVENT_BUS, useClass: NestEventBus },
  ],
  exports: [BodyMeasurementApplicationService],
})
export class MeasurementsModule {}
