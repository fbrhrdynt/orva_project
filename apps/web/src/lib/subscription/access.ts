import { db } from "@/lib/db";

export type TenantPlanAccess = {
  subscriptionId: string;
  status: "TRIAL" | "ACTIVE";
  plan: { key: string; name: string; maxUsers: number | null; maxCompanies: number | null; maxStorageMb: number | null; supportLevel: string };
  periodEnd: Date;
  moduleKeys: string[];
};

export async function getTenantPlanAccess(tenantId: string): Promise<TenantPlanAccess | null> {
  const now = new Date();
  const subscription = await db.subscription.findFirst({
    where: {
      tenantId,
      status: { in: ["TRIAL", "ACTIVE"] },
      startsAt: { lte: now },
      currentPeriodStart: { lte: now },
      currentPeriodEnd: { gt: now },
      cancelAtPeriodEnd: false,
    },
    orderBy: { createdAt: "desc" },
    include: { plan: { include: { modules: { select: { moduleKey: true } } } } },
  });
  if (!subscription) return null;
  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    plan: {
      key: subscription.plan.key,
      name: subscription.plan.name,
      maxUsers: subscription.plan.maxUsers,
      maxCompanies: subscription.plan.maxCompanies,
      maxStorageMb: subscription.plan.maxStorageMb,
      supportLevel: subscription.plan.supportLevel,
    },
    periodEnd: subscription.currentPeriodEnd,
    moduleKeys: subscription.plan.modules.map((module) => module.moduleKey),
  };
}

export async function checkTenantResourceLimit(tenantId: string, resource: "users" | "companies") {
  const access = await getTenantPlanAccess(tenantId);
  if (!access) return { allowed: false, reason: "No active ORVA subscription is available." };
  const limit = resource === "users" ? access.plan.maxUsers : access.plan.maxCompanies;
  if (limit == null) return { allowed: true, access };
  const count = resource === "users"
    ? await db.tenantMembership.count({ where: { tenantId, status: "ACTIVE" } })
    : await db.company.count({ where: { tenantId, isActive: true } });
  return count >= limit
    ? { allowed: false, reason: `Your ${access.plan.name} plan allows up to ${limit} ${resource}.`, access }
    : { allowed: true, access, count, limit };
}
