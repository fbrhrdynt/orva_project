import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const requestedCompanyId = new URL(request.url).searchParams.get("companyId");\n  const selectedCompanyId = requestedCompanyId && auth.context.companyIds.includes(requestedCompanyId) ? requestedCompanyId : auth.context.companyIds[0];\n  const [companies, user, tenant, moduleSettings, entitlements] = await Promise.all([
    db.company.findMany({
      where: { tenantId: auth.context.tenantId, id: { in: [...auth.context.companyIds] }, isActive: true },
      select: { id: true, code: true, name: true, currency: true },
      orderBy: { name: "asc" },
    }),
    db.user.findUnique({ where: { id: auth.context.userId }, select: { id: true, name: true, email: true } }),
    db.tenant.findUnique({ where: { id: auth.context.tenantId }, select: { id: true, name: true, slug: true } }),\n    selectedCompanyId ? db.companyModuleSetting.findMany({ where: { companyId: selectedCompanyId }, select: { moduleKey: true, isEnabled: true } }) : Promise.resolve([]),\n    db.tenantModuleEntitlement.findMany({ where: { tenantId: auth.context.tenantId, isIncluded: true }, select: { moduleKey: true } }),
  ]);

  return NextResponse.json({
    user,
    tenant,
    companies,
    permissions: [...auth.context.permissions],
  }, { headers: { "Cache-Control": "no-store" } });
}
