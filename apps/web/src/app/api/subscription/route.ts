import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const tenantId = auth.context.tenantId;
  const [tenant, subscription, activeUsers, activeCompanies] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } }),
    db.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { plan: { include: { modules: { orderBy: { moduleKey: "asc" }, select: { moduleKey: true } } } } },
    }),
    db.tenantMembership.count({ where: { tenantId, status: "ACTIVE" } }),
    db.company.count({ where: { tenantId, isActive: true } }),
  ]);

  return NextResponse.json({
    tenant,
    usage: { activeUsers, activeCompanies },
    subscription: subscription ? {
      id: subscription.id,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      deploymentMode: subscription.deploymentMode,
      currency: subscription.currency,
      unitPrice: subscription.unitPrice.toString(),
      startsAt: subscription.startsAt.toISOString(),
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
      contractReference: subscription.contractReference,
      plan: {
        key: subscription.plan.key,
        name: subscription.plan.name,
        maxUsers: subscription.plan.maxUsers,
        maxCompanies: subscription.plan.maxCompanies,
        maxStorageMb: subscription.plan.maxStorageMb,
        supportLevel: subscription.plan.supportLevel,
        modules: subscription.plan.modules.map((module) => module.moduleKey),
      },
    } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
