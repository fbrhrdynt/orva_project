import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type PlatformOperatorRole = "OWNER" | "ADMIN" | "BILLING" | "SUPPORT" | "PROVISIONING";

export async function getPlatformOperator(allowed: readonly PlatformOperatorRole[]) {
  const session = await getCurrentSession();
  if (!session) return null;
  const operator = await db.platformOperator.findUnique({
    where: { userId: session.userId },
    select: { id: true, role: true, isActive: true, userId: true },
  });
  if (!operator?.isActive || !allowed.includes(operator.role as PlatformOperatorRole)) return null;
  return { ...operator, tenantId: session.tenantId };
}
