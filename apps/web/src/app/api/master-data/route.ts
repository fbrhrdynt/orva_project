import { NextResponse } from "next/server";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { listCustomers, listSuppliers, listItems, listWarehouses, createCustomer, createSupplier, createItem, createWarehouse } from "@/lib/master-data/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const companyId = url.searchParams.get("companyId") ?? "";
  const search = url.searchParams.get("search") ?? "";
  try {
    const result = type === "customers" ? await listCustomers(auth.context, companyId, search)
      : type === "suppliers" ? await listSuppliers(auth.context, companyId, search)
      : type === "items" ? await listItems(auth.context, companyId, search)
      : type === "warehouses" ? await listWarehouses(auth.context, companyId)
      : null;
    if (!result) return NextResponse.json({ error: "Unknown master data type." }, { status: 400 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load master data." }, { status });
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 403 }); }
  }
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid master data payload." }, { status: 400 });
    const input = body as Record<string, unknown>;
    if (typeof input.companyId !== "string") return NextResponse.json({ error: "Company is required." }, { status: 400 });
    if (input.type === "items") {
      if (typeof input.sku !== "string" || typeof input.name !== "string" || typeof input.uomId !== "string" || typeof input.itemType !== "string") return NextResponse.json({ error: "SKU, name, unit of measure and item type are required." }, { status: 400 });
      const result = await createItem(auth.context, { companyId: input.companyId, sku: input.sku, name: input.name, uomId: input.uomId, categoryId: typeof input.categoryId === "string" ? input.categoryId : undefined, description: typeof input.description === "string" ? input.description : undefined, itemType: input.itemType, standardCost: typeof input.standardCost === "string" || typeof input.standardCost === "number" ? input.standardCost : undefined, isStockItem: typeof input.isStockItem === "boolean" ? input.isStockItem : undefined, isPurchase: typeof input.isPurchase === "boolean" ? input.isPurchase : undefined, isSales: typeof input.isSales === "boolean" ? input.isSales : undefined });
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (input.type === "warehouses") {
      if (typeof input.code !== "string" || typeof input.name !== "string") return NextResponse.json({ error: "Warehouse code and name are required." }, { status: 400 });
      const result = await createWarehouse(auth.context, { companyId: input.companyId, code: input.code, name: input.name, address: typeof input.address === "string" ? input.address : undefined });
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (typeof input.code !== "string" || typeof input.name !== "string") {
      return NextResponse.json({ error: "Company, code and name are required." }, { status: 400 });
    }
    const data = {
      companyId: input.companyId, code: input.code, name: input.name,
      city: typeof input.city === "string" ? input.city : undefined,
      country: typeof input.country === "string" ? input.country : undefined,
      currency: typeof input.currency === "string" ? input.currency : undefined,
      paymentTermDays: typeof input.paymentTermDays === "number" ? input.paymentTermDays : undefined,
      email: typeof input.email === "string" ? input.email : undefined,
      phone: typeof input.phone === "string" ? input.phone : undefined,
    };
    const result = input.type === "customers" ? await createCustomer(auth.context, data)
      : input.type === "suppliers" ? await createSupplier(auth.context, data)
      : null;
    if (!result) return NextResponse.json({ error: "Unsupported master data creation type." }, { status: 400 });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create master data." }, { status });
  }
}
