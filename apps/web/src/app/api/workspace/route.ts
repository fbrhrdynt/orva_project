import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { getTenantPlanAccess, tenantHasSubscription } from "@/lib/subscription/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const requestedCompanyId = new URL(request.url).searchParams.get("companyId");
  const selectedCompanyId = requestedCompanyId && auth.context.companyIds.includes(requestedCompanyId)
    ? requestedCompanyId
    : auth.context.companyIds[0];

  const [companies, user, tenant, moduleSettings, entitlements, planAccess] = await Promise.all([
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
  ]);

  const hasSubscription = await tenantHasSubscription(auth.context.tenantId);\n  const entitled = new Set(entitlements.map((item) => item.moduleKey));
  const configured = new Map(moduleSettings.map((item) => [item.moduleKey, item.isEnabled]));
  const enabledModules = ["procurement"].filter((key) =>
    (entitled.size === 0 || entitled.has(key)) && (configured.get(key) ?? true)
  );

  return NextResponse.json({
    user,
    tenant,
    companies,
    selectedCompanyId: selectedCompanyId ?? null,
    enabledModules,
    subscription: planAccess ? { plan: planAccess.plan.name, status: planAccess.status, currentPeriodEnd: planAccess.periodEnd, maxUsers: planAccess.plan.maxUsers, maxCompanies: planAccess.plan.maxCompanies, maxStorageMb: planAccess.plan.maxStorageMb, modules: planAccess.moduleKeys } : null,\n    subscriptionRequired: hasSubscription && !planAccess,
    permissions: [...auth.context.permissions],
  }, { headers: { "Cache-Control": "no-store" } });
}
