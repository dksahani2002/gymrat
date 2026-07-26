import { Module } from '@nestjs/common';
import { WorkoutApplicationService } from '../../application/workout/workout.application-service';
import { AUDIT_LOG_PORT } from '../../application/identity/ports/audit-log.port';
import { WORKOUT_REPOSITORY } from '../../domain/workout/repositories/workout.repository';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { NestEventBus } from '../../infrastructure/events/nest-event-bus';
import { WorkoutPrismaRepository } from '../../infrastructure/persistence/repositories/workout.prisma-repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { WorkoutsController } from './workouts.controller';

@Module({
  controllers: [WorkoutsController],
  providers: [
    WorkoutApplicationService,
    { provide: WORKOUT_REPOSITORY, useClass: WorkoutPrismaRepository },
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
    { provide: EVENT_BUS, useClass: NestEventBus },
  ],
  exports: [WorkoutApplicationService],
})
export class WorkoutsModule {}
