import { Module } from '@nestjs/common';
import { ExerciseApplicationService } from '../../application/exercise/exercise.application-service';
import { AUDIT_LOG_PORT } from '../../application/identity/ports/audit-log.port';
import { EXERCISE_REPOSITORY } from '../../domain/exercise/repositories/exercise.repository';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { NestEventBus } from '../../infrastructure/events/nest-event-bus';
import { ExercisePrismaRepository } from '../../infrastructure/persistence/repositories/exercise.prisma-repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { ExercisesController } from './exercises.controller';

@Module({
  controllers: [ExercisesController],
  providers: [
    ExerciseApplicationService,
    { provide: EXERCISE_REPOSITORY, useClass: ExercisePrismaRepository },
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
    { provide: EVENT_BUS, useClass: NestEventBus },
  ],
  exports: [ExerciseApplicationService],
})
export class ExercisesModule {}
