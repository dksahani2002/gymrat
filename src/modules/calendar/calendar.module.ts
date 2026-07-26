import { Module } from '@nestjs/common';
import { CalendarApplicationService } from '../../application/calendar/calendar.application-service';
import { AUDIT_LOG_PORT } from '../../application/identity/ports/audit-log.port';
import { CALENDAR_REPOSITORY } from '../../domain/calendar/repositories/calendar.repository';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { CalendarPrismaRepository } from '../../infrastructure/persistence/repositories/calendar.prisma-repository';
import { CalendarController } from './calendar.controller';

@Module({
  controllers: [CalendarController],
  providers: [
    CalendarApplicationService,
    { provide: CALENDAR_REPOSITORY, useClass: CalendarPrismaRepository },
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
  ],
  exports: [CalendarApplicationService],
})
export class CalendarModule {}
