import { db } from "@/lib/db";
import { requireCompanyAccess, requirePermission, type VerifiedTenantContext } from "@/lib/tenant/access";

export type MasterDataResult<T> = { items: T[]; total: number };

function cleanText(value: string, label: string, max = 120): string {
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters.`);
  return result;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 3650) throw new Error(`${label} must be a whole number between 0 and 3650.`);
  return value;
}

async function assertCompany(context: VerifiedTenantContext, companyId: string) {
  requireCompanyAccess(context, companyId);
  const company = await db.company.findFirst({
    where: { id: companyId, tenantId: context.tenantId, isActive: true },
    select: { id: true }
  });
  if (!company) throw new Error("Company was not found in the active tenant.");
}

export async function listCustomers(context: VerifiedTenantContext, companyId: string, search = ""): Promise<{ items: Awaited<ReturnType<typeof db.customer.findMany>>; total: number }> {
  requirePermission(context, "master-data.customer.read");
  await assertCompany(context, companyId);
  const term = search.trim();
  const where = {
    tenantId: context.tenantId,
    companyId,
    ...(term ? { OR: [{ code: { contains: term, mode: "insensitive" as const } }, { name: { contains: term, mode: "insensitive" as const } }] } : {})
  };
  const [items, total] = await db.$transaction([
    db.customer.findMany({ where, orderBy: { name: "asc" }, take: 100 }),
    db.customer.count({ where })
  ]);
  return { items, total };
}

export async function createCustomer(context: VerifiedTenantContext, input: {
  companyId: string; code: string; name: string; city?: string; country?: string;
  currency?: string; paymentTermDays?: number; email?: string; phone?: string;
}) {
  requirePermission(context, "master-data.customer.create");
  await assertCompany(context, input.companyId);
  const code = cleanText(input.code, "Customer code", 32).toUpperCase();
  const name = cleanText(input.name, "Customer name", 180);
  const paymentTermDays = positiveInteger(input.paymentTermDays ?? 30, "Payment term");
  const currency = cleanText(input.currency ?? "IDR", "Currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code.");
  const email = input.email?.trim().toLowerCase() || undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email address is invalid.");
  return db.customer.create({
    data: {
      tenantId: context.tenantId, companyId: input.companyId, code, name,
      city: input.city?.trim() || undefined, country: input.country?.trim() || "Indonesia",
      currency, paymentTermDays, email, phone: input.phone?.trim() || undefined
    }
  });
}

export async function listSuppliers(context: VerifiedTenantContext, companyId: string, search = "") {
  requirePermission(context, "master-data.supplier.read");
  await assertCompany(context, companyId);
  const term = search.trim();
  const where = {
    tenantId: context.tenantId, companyId,
    ...(term ? { OR: [{ code: { contains: term, mode: "insensitive" as const } }, { name: { contains: term, mode: "insensitive" as const } }] } : {})
  };
  const [items, total] = await db.$transaction([
    db.supplier.findMany({ where, orderBy: { name: "asc" }, take: 100 }),
    db.supplier.count({ where })
  ]);
  return { items, total };
}

export async function createSupplier(context: VerifiedTenantContext, input: {
  companyId: string; code: string; name: string; city?: string; country?: string;
  currency?: string; paymentTermDays?: number; email?: string; phone?: string;
}) {
  requirePermission(context, "master-data.supplier.create");
  await assertCompany(context, input.companyId);
  const code = cleanText(input.code, "Supplier code", 32).toUpperCase();
  const name = cleanText(input.name, "Supplier name", 180);
  const paymentTermDays = positiveInteger(input.paymentTermDays ?? 30, "Payment term");
  const currency = cleanText(input.currency ?? "IDR", "Currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code.");
  const email = input.email?.trim().toLowerCase() || undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email address is invalid.");
  return db.supplier.create({
    data: {
      tenantId: context.tenantId, companyId: input.companyId, code, name,
      city: input.city?.trim() || undefined, country: input.country?.trim() || "Indonesia",
      currency, paymentTermDays, email, phone: input.phone?.trim() || undefined
    }
  });
}

export async function listItems(context: VerifiedTenantContext, companyId: string, search = "") {
  requirePermission(context, "master-data.item.read");
  await assertCompany(context, companyId);
  const term = search.trim();
  const where = {
    tenantId: context.tenantId, companyId,
    ...(term ? { OR: [{ sku: { contains: term, mode: "insensitive" as const } }, { name: { contains: term, mode: "insensitive" as const } }] } : {})
  };
  const [items, total] = await db.$transaction([
    db.item.findMany({ where, include: { category: true, uom: true }, orderBy: { name: "asc" }, take: 100 }),
    db.item.count({ where })
  ]);
  return { items, total };
}

export async function listWarehouses(context: VerifiedTenantContext, companyId: string) {
  requirePermission(context, "master-data.warehouse.read");
  await assertCompany(context, companyId);
  const [items, total] = await db.$transaction([
    db.warehouse.findMany({ where: { tenantId: context.tenantId, companyId }, orderBy: { code: "asc" }, take: 100 }),
    db.warehouse.count({ where: { tenantId: context.tenantId, companyId } })
  ]);
  return { items, total };
}
