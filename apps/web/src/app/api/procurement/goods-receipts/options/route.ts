import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { requireCompanyAccess, requirePermission } from "@/lib/tenant/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId") ?? "";
    requirePermission(auth.context, "procurement.goods_receipt.read");
    requirePermission(auth.context, "procurement.purchase_order.read");
    requireCompanyAccess(auth.context, companyId);
    const [warehouses, orders] = await Promise.all([
      db.warehouse.findMany({
        where: { tenantId: auth.context.tenantId, companyId, isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
      db.purchaseOrder.findMany({
        where: { tenantId: auth.context.tenantId, companyId, status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] } },
        select: {
          id: true, documentNumber: true, currency: true,
          supplier: { select: { code: true, name: true } },
          lines: {
            select: { id: true, lineNumber: true, description: true, quantity: true, receivedQty: true, uomCode: true, item: { select: { sku: true, name: true } } },
            orderBy: { lineNumber: "asc" },
          },
        },
        orderBy: [{ documentDate: "desc" }, { documentNumber: "desc" }],
        take: 100,
      }),
    ]);
    const eligibleOrders = orders.map(order => ({
      ...order,
      lines: order.lines.filter(line => line.quantity.gt(line.receivedQty)).map(line => ({
        ...line, quantity: line.quantity.toString(), receivedQty: line.receivedQty.toString(),
        remainingQty: line.quantity.minus(line.receivedQty).toString(),
      })),
    })).filter(order => order.lines.length > 0);
    return NextResponse.json({ warehouses, orders: eligibleOrders }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load receiving options." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
