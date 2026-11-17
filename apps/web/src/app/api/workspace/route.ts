import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const [companies, user, tenant] = await Promise.all([
    db.company.findMany({
      where: { tenantId: auth.context.tenantId, id: { in: [...auth.context.companyIds] }, isActive: true },
      select: { id: true, code: true, name: true, currency: true },
      orderBy: { name: "asc" },
    }),
    db.user.findUnique({ where: { id: auth.context.userId }, select: { id: true, name: true, email: true } }),
    db.tenant.findUnique({ where: { id: auth.context.tenantId }, select: { id: true, name: true, slug: true } }),
  ]);

  return NextResponse.json({
    user,
    tenant,
    companies,
    permissions: [...auth.context.permissions],
  }, { headers: { "Cache-Control": "no-store" } });
}
