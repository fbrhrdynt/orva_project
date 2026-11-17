import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { requireCompanyAccess, requirePermission } from "@/lib/tenant/access";
import { createGoodsReceipt } from "@/lib/procurement/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    requirePermission(auth.context, "procurement.goods_receipt.read");
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId") ?? "";
    requireCompanyAccess(auth.context, companyId);
    const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);
    const where = { tenantId: auth.context.tenantId, companyId };
    const [items, total] = await db.$transaction([
      db.goodsReceipt.findMany({
        where,
        include: {
          warehouse: { select: { code: true, name: true } },
          purchaseOrder: { select: { documentNumber: true, supplier: { select: { code: true, name: true } } } },
          _count: { select: { lines: true } },
        },
        orderBy: [{ receivedAt: "desc" }, { documentNumber: "desc" }],
        take,
      }),
      db.goodsReceipt.count({ where }),
    ]);
    return NextResponse.json({ items, total }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list goods receipts." }, { status });
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid goods receipt payload." }, { status: 400 });
    }
    const result = await createGoodsReceipt(auth.context, input as Parameters<typeof createGoodsReceipt>[1]);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create goods receipt." }, { status });
  }
}
