import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { requireCompanyAccess, requirePermission } from "@/lib/tenant/access";

export const dynamic = "force-dynamic";
const MODULES = ["finance","sales","procurement","inventory","people","projects","operations","documents","quality","manufacturing","logistics","assets","timesheets"] as const;
const DEFAULT_ENABLED = new Set(["procurement"]);

function failure(error: unknown) {
  const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process company settings." }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    requirePermission(auth.context, "company.settings.read");
    const companyId = new URL(request.url).searchParams.get("companyId") ?? "";
    requireCompanyAccess(auth.context, companyId);
    const company = await db.company.findFirst({
      where: { id: companyId, tenantId: auth.context.tenantId },
      include: { configuration: true, moduleSettings: { orderBy: { moduleKey: "asc" } }, units: { where: { isActive: true }, orderBy: { name: "asc" } } },
    });
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const saved = new Map(company.moduleSettings.map((item) => [item.moduleKey, item]));
    const modules = MODULES.map((key) => {
      const setting = saved.get(key);
      return { key, isEnabled: setting?.isEnabled ?? DEFAULT_ENABLED.has(key), configuration: setting?.configuration ?? null };
    });
    return NextResponse.json({
      company: { id: company.id, code: company.code, name: company.name, legalName: company.legalName, taxId: company.taxId, currency: company.currency },
      configuration: company.configuration,
      modules,
      businessUnits: company.units,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host) { try { if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 }); } catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 403 }); } }
  const auth = await getVerifiedTenantContext();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    requirePermission(auth.context, "company.settings.manage");
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const companyId = typeof input.companyId === "string" ? input.companyId : "";
    requireCompanyAccess(auth.context, companyId);
    const company = await db.company.findFirst({ where: { id: companyId, tenantId: auth.context.tenantId }, select: { id: true } });
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    const updates: Promise<unknown>[] = [];
    if (input.company && typeof input.company === "object" && !Array.isArray(input.company)) {
      const value = input.company as Record<string, unknown>;
      const data: Record<string, string | null> = {};
      for (const key of ["name","legalName","taxId","currency"] as const) {
        if (typeof value[key] === "string") data[key] = value[key].trim();
      }
      if (data.name !== undefined && (!data.name || data.name.length > 180)) throw new Error("Company name is required and must be under 180 characters.");
      if (data.currency !== undefined && !/^[A-Z]{3}$/.test(data.currency.toUpperCase())) throw new Error("Currency must be a three-letter code.");
      if (data.currency) data.currency = data.currency.toUpperCase();
      if (Object.keys(data).length) updates.push(db.company.update({ where: { id: companyId }, data }));
    }
    if (input.configuration && typeof input.configuration === "object" && !Array.isArray(input.configuration)) {
      const value = input.configuration as Record<string, unknown>;
      const locale = typeof value.locale === "string" ? value.locale : "en";
      const timezone = typeof value.timezone === "string" ? value.timezone : "Asia/Jakarta";
      const dateFormat = typeof value.dateFormat === "string" ? value.dateFormat : "dd/MM/yyyy";
      const numberFormat = typeof value.numberFormat === "string" ? value.numberFormat : "1.234,56";
      const fiscalYearStartMonth = Number(value.fiscalYearStartMonth ?? 1);
      const weekStartsOn = Number(value.weekStartsOn ?? 1);
      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale) || timezone.length > 80 || !/^[w/+-]{1,32}$/.test(timezone) || dateFormat.length > 32 || numberFormat.length > 32 || !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12 || !Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) throw new Error("Company localization settings are invalid.");
      updates.push(db.companyConfiguration.upsert({
        where: { companyId },
        update: { locale, timezone, dateFormat, numberFormat, fiscalYearStartMonth, weekStartsOn },
        create: { companyId, locale, timezone, dateFormat, numberFormat, fiscalYearStartMonth, weekStartsOn },
      }));
    }
    if (Array.isArray(input.modules)) {
      if (input.modules.length > MODULES.length) throw new Error("Too many module settings.");
      for (const entry of input.modules) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid module setting.");
        const item = entry as Record<string, unknown>;
        if (typeof item.key !== "string" || !MODULES.includes(item.key as typeof MODULES[number]) || typeof item.isEnabled !== "boolean") throw new Error("Invalid module key or enabled state.");
        const key = item.key;
        const isEnabled = item.isEnabled;
        updates.push(db.companyModuleSetting.upsert({
          where: { companyId_moduleKey: { companyId, moduleKey: key } },
          update: { isEnabled },
          create: { companyId, moduleKey: key, isEnabled },
        }));
      }
    }
    await db.$transaction(updates);
    await db.auditEvent.create({ data: { tenantId: auth.context.tenantId, actorUserId: auth.context.userId, action: "company.settings.updated", entityType: "Company", entityId: companyId, metadata: { company: Boolean(input.company), configuration: Boolean(input.configuration), modules: Array.isArray(input.modules) ? input.modules.length : 0 } } });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
