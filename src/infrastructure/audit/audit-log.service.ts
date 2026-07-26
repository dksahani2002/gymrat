import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditLogInput,
  AuditLogPort,
} from '../../application/identity/ports/audit-log.port';
import { PrismaService } from '../persistence/prisma/prisma.service';

@Injectable()
export class AuditLogService implements AuditLogPort {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          beforeJson:
            input.beforeJson === undefined
              ? undefined
              : (input.beforeJson as Prisma.InputJsonValue),
          afterJson:
            input.afterJson === undefined
              ? undefined
              : (input.afterJson as Prisma.InputJsonValue),
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          requestId: input.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', error instanceof Error ? error.stack : error);
    }
  }
}
