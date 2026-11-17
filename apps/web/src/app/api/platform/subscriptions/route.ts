import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlatformOperator } from "@/lib/platform/access";

export const dynamic = "force-dynamic";
const ROLES = ["OWNER", "ADMIN", "BILLING", "PROVISIONING"] as const;
const ACTIVE_STATUSES = new Set(["TRIAL", "ACTIVE"]);
const DEPLOYMENT_MODES = ["SHARED_CLOUD", "DEDICATED_CLOUD", "SELF_HOSTED"] as const;
const BILLING_INTERVALS = ["MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"] as const;
const SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"] as const;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const operator = await getPlatformOperator(ROLES);
  if (!operator) return fail("Platform operator access required.", 403);

  const [tenants, plans] = await Promise.all([
    db.tenant.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      select: {
        id: true, name: true, slug: true, status: true, createdAt: true,
        _count: { select: { memberships: true, companies: true } },
        subscriptions: {
          orderBy: { createdAt: "desc" }, take: 1,
          select: { id: true, status: true, deploymentMode: true, billingInterval: true, currency: true, unitPrice: true, currentPeriodEnd: true, plan: { select: { key: true, name: true } } }
        }
      }
    }),
    db.productPlan.findMany({
      where: { isActive: true }, orderBy: { name: "asc" },
      select: { id: true, key: true, name: true, maxUsers: true, maxCompanies: true, maxStorageMb: true, supportLevel: true, modules: { select: { moduleKey: true } } }
    })
  ]);
  return NextResponse.json({ tenants, plans }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return fail("Cross-origin request rejected.", 403); }
    catch { return fail("Invalid request origin.", 403); }
  }
  const operator = await getPlatformOperator(["OWNER", "ADMIN", "BILLING", "PROVISIONING"]);
  if (!operator) return fail("Platform operator access required.", 403);

  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) return fail("Invalid provisioning payload.");
    const data = input as Record<string, unknown>;
    const tenantId = typeof data.tenantId === "string" ? data.tenantId : "";
    const planId = typeof data.planId === "string" ? data.planId : "";
    const deploymentValue = typeof data.deploymentMode === "string" ? data.deploymentMode : "";
    const billingValue = typeof data.billingInterval === "string" ? data.billingInterval : "";
    const statusValue = typeof data.status === "string" ? data.status : "";
    const currency = typeof data.currency === "string" ? data.currency.toUpperCase() : "IDR";
    const unitPrice = typeof data.unitPrice === "number" ? data.unitPrice : Number.NaN;
    const currentPeriodEnd = typeof data.currentPeriodEnd === "string" ? new Date(data.currentPeriodEnd) : new Date(Number.NaN);

    if (!tenantId || !planId || !DEPLOYMENT_MODES.some((value) => value === deploymentValue)) return fail("Tenant, plan and deployment mode are required.");
    if (!BILLING_INTERVALS.some((value) => value === billingValue)) return fail("Invalid billing interval.");
    if (!SUBSCRIPTION_STATUSES.some((value) => value === statusValue)) return fail("Invalid subscription status.");
    if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(unitPrice) || unitPrice < 0 || Number.isNaN(currentPeriodEnd.getTime())) return fail("Invalid currency, price or period end.");

    const deploymentMode = deploymentValue as typeof DEPLOYMENT_MODES[number];
    const billingInterval = billingValue as typeof BILLING_INTERVALS[number];
    const status = statusValue as typeof SUBSCRIPTION_STATUSES[number];

    const [tenant, plan] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, status: true } }),
      db.productPlan.findFirst({ where: { id: planId, isActive: true }, include: { modules: { select: { moduleKey: true } } } })
    ]);
    if (!tenant || tenant.status !== "ACTIVE") return fail("Active tenant not found.", 404);
    if (!plan) return fail("Active product plan not found.", 404);
    const now = new Date();
    if (currentPeriodEnd <= now) return fail("Subscription period end must be in the future.");

    const result = await db.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { tenantId, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED"] } },
        data: { status: "CANCELLED", cancelledAt: now, cancelAtPeriodEnd: false }
      });
      const subscription = await tx.subscription.create({
        data: {
          tenantId, planId, status, deploymentMode, billingInterval,
          currency, unitPrice, startsAt: now, currentPeriodStart: now, currentPeriodEnd,
          trialEndsAt: status === "TRIAL" ? currentPeriodEnd : null
        },
        select: { id: true, tenantId: true, planId: true, status: true, deploymentMode: true, currentPeriodEnd: true }
      });
      const moduleKeys = ACTIVE_STATUSES.has(status) ? plan.modules.map((module) => module.moduleKey) : [];
      await tx.tenantModuleEntitlement.deleteMany({ where: { tenantId } });
      if (moduleKeys.length) await tx.tenantModuleEntitlement.createMany({
        data: moduleKeys.map((moduleKey) => ({ tenantId, moduleKey, isIncluded: true }))
      });
      await tx.auditEvent.create({
        data: {
          tenantId, actorUserId: operator.userId, action: "platform.subscription.provisioned",
          entityType: "Subscription", entityId: subscription.id,
          metadata: { planKey: plan.key, deploymentMode, billingInterval, currency, unitPrice, status, moduleKeys }
        }
      });
      return { subscription, effectiveModules: moduleKeys };
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to provision subscription.");
  }
}
