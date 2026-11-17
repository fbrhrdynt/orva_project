import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/tenant/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host) { try { if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 }); } catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 403 }); } }
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    requirePermission(auth.context, "company.settings.manage");
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid company payload." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "IDR";
    const locale = typeof input.locale === "string" ? input.locale : "id";
    const timezone = typeof input.timezone === "string" ? input.timezone : "Asia/Jakarta";
    if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) throw new Error("Company code must be 2–20 letters, numbers, underscores or hyphens.");
    if (!name || name.length > 180) throw new Error("Company name is required and must be under 180 characters.");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code.");
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale) || timezone.length > 80 || !/^[\w/+-]{1,32}$/.test(timezone)) throw new Error("Locale or time zone is invalid.");

    const entitlements = await db.tenantModuleEntitlement.findMany({ where: { tenantId: auth.context.tenantId, isIncluded: true }, select: { moduleKey: true } });
    const created = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId: auth.context.tenantId,
          code,
          name,
          legalName: typeof input.legalName === "string" ? input.legalName.trim() || null : null,
          taxId: typeof input.taxId === "string" ? input.taxId.trim() || null : null,
          currency,
        },
      });
      await tx.membershipCompanyAccess.create({ data: { membershipId: auth.context.membershipId, companyId: company.id } });
      await tx.companyConfiguration.create({ data: { companyId: company.id, locale, timezone, dateFormat: locale === "id" ? "dd/MM/yyyy" : "yyyy-MM-dd", numberFormat: locale === "id" ? "1.234,56" : "1,234.56", fiscalYearStartMonth: 1 } });
      if (entitlements.length) await tx.companyModuleSetting.createMany({ data: entitlements.map((item) => ({ companyId: company.id, moduleKey: item.moduleKey, isEnabled: false })) });
      await tx.auditEvent.create({ data: { tenantId: auth.context.tenantId, actorUserId: auth.context.userId, action: "company.created", entityType: "Company", entityId: company.id, metadata: { code, name, currency } } });
      return company;
    });
    return NextResponse.json({ company: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create company." }, { status });
  }
}
