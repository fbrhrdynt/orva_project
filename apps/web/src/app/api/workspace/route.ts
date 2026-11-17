import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { getTenantPlanAccess, tenantHasSubscription } from "@/lib/subscription/access";
import { MODULE_REGISTRY } from "@/lib/modules/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const requestedCompanyId = new URL(request.url).searchParams.get("companyId");
  const selectedCompanyId = requestedCompanyId && auth.context.companyIds.includes(requestedCompanyId)
    ? requestedCompanyId
    : auth.context.companyIds[0];

  const [companies, user, tenant, moduleSettings, entitlements, planAccess, hasSubscription] = await Promise.all([
    db.company.findMany({
      where: { tenantId: auth.context.tenantId, id: { in: [...auth.context.companyIds] }, isActive: true },
      select: { id: true, code: true, name: true, currency: true },
      orderBy: { name: "asc" },
    }),
    db.user.findUnique({ where: { id: auth.context.userId }, select: { id: true, name: true, email: true } }),
    db.tenant.findUnique({ where: { id: auth.context.tenantId }, select: { id: true, name: true, slug: true } }),
    selectedCompanyId ? db.companyModuleSetting.findMany({ where: { companyId: selectedCompanyId }, select: { moduleKey: true, isEnabled: true } }) : Promise.resolve([]),
    db.tenantModuleEntitlement.findMany({ where: { tenantId: auth.context.tenantId, isIncluded: true }, select: { moduleKey: true } }),
    getTenantPlanAccess(auth.context.tenantId),
    tenantHasSubscription(auth.context.tenantId),
  ]);

  const entitled = new Set(entitlements.map((item) => item.moduleKey));
  const configured = new Map(moduleSettings.map((item) => [item.moduleKey, item.isEnabled]));
  const planModules = new Set(planAccess?.moduleKeys ?? []);
  const enabledModules = MODULE_REGISTRY
    .filter((module) => module.status === "AVAILABLE")
    .filter((module) => planAccess
      ? planModules.has(module.key)
      : entitled.size === 0 || entitled.has(module.key))
    .filter((module) => configured.get(module.key) ?? true)
    .map((module) => module.key);

  return NextResponse.json({
    user,
    tenant,
    companies,
    selectedCompanyId: selectedCompanyId ?? null,
    enabledModules,
    subscription: planAccess ? {
      plan: planAccess.plan.name,
      status: planAccess.status,
      currentPeriodEnd: planAccess.periodEnd,
      cancelAtPeriodEnd: planAccess.cancelAtPeriodEnd,
      maxUsers: planAccess.plan.maxUsers,
      maxCompanies: planAccess.plan.maxCompanies,
      maxStorageMb: planAccess.plan.maxStorageMb,
      modules: planAccess.moduleKeys,
    } : null,
    subscriptionRequired: hasSubscription && !planAccess,
    permissions: [...auth.context.permissions],
  }, { headers: { "Cache-Control": "no-store" } });
}
