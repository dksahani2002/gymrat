export const AUDIT_LOG_PORT = Symbol('AUDIT_LOG_PORT');

export interface AuditLogInput {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Port for append-only audit logging.
 */
export interface AuditLogPort {
  record(input: AuditLogInput): Promise<void>;
}
