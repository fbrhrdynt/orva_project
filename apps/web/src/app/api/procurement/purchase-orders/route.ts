import { NextResponse } from "next/server";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/procurement/service";

export const dynamic = "force-dynamic";

function safeApiError(error: unknown, fallback: string): string {
  if (error instanceof Error && !error.name.toLowerCase().includes("prisma") && !error.message.includes("Invalid `prisma.")) {
    return error.message;
  }
  console.error("[ORVA procurement API]", error);
  return fallback;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId") ?? "";
    const result = await listPurchaseOrders(auth.context, {
      companyId,
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      take: Number(url.searchParams.get("take") ?? 50),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: safeApiError(error, "Unable to load purchase orders. Please try again or contact your administrator.") }, { status });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid purchase order payload." }, { status: 400 });
    }
    const result = await createPurchaseOrder(auth.context, input as Parameters<typeof createPurchaseOrder>[1]);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: safeApiError(error, "Unable to save the purchase order. Check the entered information and try again.") }, { status });
  }
}
