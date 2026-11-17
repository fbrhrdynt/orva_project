import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { requireCompanyAccess, requirePermission } from "@/lib/tenant/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    requirePermission(auth.context, "company.settings.read");
    const url = new URL(request.url);
    const requested = url.searchParams.get("companyId");
    const companyId = requested && auth.context.companyIds.includes(requested) ? requested : auth.context.companyIds[0];
    if (!companyId) return NextResponse.json({ error: "No active company is assigned to this account." }, { status: 403 });
    requireCompanyAccess(auth.context, companyId);

    const company = await db.company.findFirst({
      where: { id: companyId, tenantId: auth.context.tenantId, isActive: true },
      select: { id: true, code: true, name: true, currency: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const base = { tenantId: auth.context.tenantId, companyId };
    const companyOrderIds = await db.purchaseOrder.findMany({ where: base, select: { id: true } });
    const [purchaseOrders, requisitions, receipts, suppliers, customers, items, warehouses, recentOrders, activity] = await Promise.all([
      db.purchaseOrder.groupBy({ by: ["status"], where: base, _count: { _all: true }, _sum: { grandTotal: true } }),
      db.purchaseRequisition.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
      db.goodsReceipt.count({ where: base }),
      db.supplier.count({ where: { ...base, isActive: true } }),
      db.customer.count({ where: { ...base, isActive: true } }),
      db.item.count({ where: { ...base, isActive: true } }),
      db.warehouse.count({ where: { ...base, isActive: true } }),
      db.purchaseOrder.findMany({
        where: base,
        orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: { id: true, documentNumber: true, documentDate: true, status: true, currency: true, grandTotal: true, supplier: { select: { name: true } } },
      }),
      db.auditEvent.findMany({
        where: { tenantId: auth.context.tenantId, occurredAt: { gte: since }, entityId: { in: companyOrderIds.map(row => row.id) } },
        orderBy: { occurredAt: "desc" },
        take: 8,
        select: { id: true, action: true, entityType: true, entityId: true, severity: true, occurredAt: true, actorUserId: true },
      }),
    ]);

    const count = (statuses: Array<{ status: string; _count: { _all: number } }>, keys: string[]) => statuses.filter(row => keys.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);
    const total = purchaseOrders.reduce((sum, row) => sum + Number(row._sum.grandTotal ?? 0), 0);
    const submittedValue = purchaseOrders.filter(row => row.status === "SUBMITTED").reduce((sum, row) => sum + Number(row._sum.grandTotal ?? 0), 0);
    return NextResponse.json({
      company,
      metrics: {
        purchaseOrders: purchaseOrders.reduce((sum, row) => sum + row._count._all, 0),
        pendingApproval: count(purchaseOrders, ["SUBMITTED"]) + count(requisitions, ["SUBMITTED"]),
        committedPurchaseValue: total,
        pendingPurchaseValue: submittedValue,
        requisitions: requisitions.reduce((sum, row) => sum + row._count._all, 0),
        goodsReceipts: receipts,
        suppliers, customers, items, warehouses,
      },
      purchaseOrders: recentOrders.map(row => ({ ...row, documentDate: row.documentDate.toISOString(), grandTotal: row.grandTotal.toString() })),
      activity: activity.map(row => ({ ...row, occurredAt: row.occurredAt.toISOString() })),
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load overview." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
