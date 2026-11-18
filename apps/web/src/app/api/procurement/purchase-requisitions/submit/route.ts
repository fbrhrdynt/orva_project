import { NextResponse } from "next/server";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { submitPurchaseRequisition } from "@/lib/procurement/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host) { try { if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 }); } catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 403 }); } }
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const input = await request.json() as Record<string, unknown>;
    if (typeof input.companyId !== "string" || typeof input.requisitionId !== "string") return NextResponse.json({ error: "Company and requisition are required." }, { status: 400 });
    const result = await submitPurchaseRequisition(auth.context, input.companyId, input.requisitionId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit purchase requisition." }, { status });
  }
}
