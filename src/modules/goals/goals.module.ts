import { Module } from '@nestjs/common';
import { GoalsApplicationService } from '../../application/goals/goals.application-service';
import { AUDIT_LOG_PORT } from '../../application/identity/ports/audit-log.port';
import { GOAL_REPOSITORY } from '../../domain/goal/repositories/goal.repository';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { NestEventBus } from '../../infrastructure/events/nest-event-bus';
import { GoalPrismaRepository } from '../../infrastructure/persistence/repositories/goal.prisma-repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { GoalProgressListener } from './goal-progress.listener';
import { GoalsController } from './goals.controller';

@Module({
  controllers: [GoalsController],
  providers: [
    GoalsApplicationService,
    GoalProgressListener,
    { provide: GOAL_REPOSITORY, useClass: GoalPrismaRepository },
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
    { provide: EVENT_BUS, useClass: NestEventBus },
  ],
  exports: [GoalsApplicationService],
})
export class GoalsModule {}
