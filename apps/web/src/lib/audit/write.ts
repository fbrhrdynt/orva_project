import { db } from "@/lib/db";
import type { VerifiedTenantContext } from "@/lib/tenant/access";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

/** Write audit events server-side; never accept tenant or actor IDs from request bodies. */
export async function writeAuditEvent(context: VerifiedTenantContext, input: AuditInput) {
  return db.auditEvent.create({
    data: {
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      severity: input.severity ?? "INFO",
      metadata: input.metadata as object | undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });
}
