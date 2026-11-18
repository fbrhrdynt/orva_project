import { NextResponse } from "next/server";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { listStockBalances, postStockAdjustment, transferStock } from "@/lib/inventory/stock-service";

export const dynamic = "force-dynamic";

function status(error: unknown) {
  return typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
}

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? "";
  try {
    const result = await listStockBalances(auth.context, companyId, url.searchParams.get("search") ?? "");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load stock balances." }, { status: status(error), headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 403 }); }
  }
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid inventory payload." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const companyId = typeof data.companyId === "string" ? data.companyId : "";
    const itemId = typeof data.itemId === "string" ? data.itemId : "";
    const quantity = typeof data.quantity === "string" || typeof data.quantity === "number" ? data.quantity : "";
    if (!companyId || !itemId || quantity === "") return NextResponse.json({ error: "Company, item and quantity are required." }, { status: 400 });
    const key = typeof data.idempotencyKey === "string" ? data.idempotencyKey : undefined;
    const notes = typeof data.notes === "string" ? data.notes : undefined;
    if (data.action === "TRANSFER") {
      if (typeof data.fromWarehouseId !== "string" || typeof data.toWarehouseId !== "string") return NextResponse.json({ error: "Source and destination warehouses are required." }, { status: 400 });
      const result = await transferStock(auth.context, { companyId, itemId, fromWarehouseId: data.fromWarehouseId, toWarehouseId: data.toWarehouseId, quantity, notes, idempotencyKey: key });
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (data.action === "ADJUSTMENT_IN" || data.action === "ADJUSTMENT_OUT") {
      if (typeof data.warehouseId !== "string") return NextResponse.json({ error: "Warehouse is required." }, { status: 400 });
      const unitCost = typeof data.unitCost === "string" || typeof data.unitCost === "number" ? data.unitCost : undefined;
      const result = await postStockAdjustment(auth.context, { companyId, itemId, warehouseId: data.warehouseId, quantity, movementType: data.action, notes, idempotencyKey: key, unitCost });
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Unsupported inventory action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to post inventory transaction." }, { status: status(error), headers: { "Cache-Control": "no-store" } });
  }
}
