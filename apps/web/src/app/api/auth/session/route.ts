import { NextResponse } from "next/server";
import { getCurrentSession, getVerifiedTenantContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getVerifiedTenantContext();
  if (!result) {
    return NextResponse.json({ authenticated: false }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const { session, context } = result;
  return NextResponse.json({
    authenticated: true,
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
    tenant: { id: session.tenant.id, slug: session.tenant.slug, name: session.tenant.name },
    companyIds: context.companyIds,
    expiresAt: session.expiresAt.toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
