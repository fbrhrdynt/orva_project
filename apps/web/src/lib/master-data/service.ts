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

export async function createWarehouse(context: VerifiedTenantContext, input: {
  companyId: string; code: string; name: string; address?: string;
}) {
  requirePermission(context, "master-data.warehouse.create");
  await assertCompany(context, input.companyId);
  const code = cleanText(input.code, "Warehouse code", 32).toUpperCase();
  const name = cleanText(input.name, "Warehouse name", 180);
  const warehouse = await db.warehouse.create({
    data: { tenantId: context.tenantId, companyId: input.companyId, code, name, address: input.address?.trim() || undefined },
  });
  await db.auditEvent.create({ data: { tenantId: context.tenantId, actorUserId: context.userId, action: "master_data.warehouse.created", entityType: "Warehouse", entityId: warehouse.id, metadata: { companyId: input.companyId, code } } });
  return warehouse;
}

export async function createItem(context: VerifiedTenantContext, input: {
  companyId: string; sku: string; name: string; uomId: string; categoryId?: string;
  description?: string; itemType: string; standardCost?: string | number;
  isStockItem?: boolean; isPurchase?: boolean; isSales?: boolean;
}) {
  requirePermission(context, "master-data.item.create");
  await assertCompany(context, input.companyId);
  const sku = cleanText(input.sku, "Item SKU", 64).toUpperCase();
  const name = cleanText(input.name, "Item name", 180);
  const itemType = cleanText(input.itemType, "Item type", 32).toUpperCase();
  const uom = await db.unitOfMeasure.findFirst({ where: { id: input.uomId, tenantId: context.tenantId }, select: { id: true } });
  if (!uom) throw new Error("Unit of measure was not found in this tenant.");
  if (input.categoryId) {
    const category = await db.itemCategory.findFirst({ where: { id: input.categoryId, tenantId: context.tenantId }, select: { id: true } });
    if (!category) throw new Error("Item category was not found in this tenant.");
  }
  let standardCost: import("@prisma/client").Prisma.Decimal | undefined;
  if (input.standardCost !== undefined && input.standardCost !== "") {
    try { standardCost = new (await import("@prisma/client")).Prisma.Decimal(input.standardCost); }
    catch { throw new Error("Standard cost must be a valid number."); }
    if (!standardCost.isFinite() || standardCost.lt(0)) throw new Error("Standard cost cannot be negative.");
  }
  const item = await db.item.create({
    data: {
      tenantId: context.tenantId, companyId: input.companyId, sku, name, uomId: input.uomId,
      categoryId: input.categoryId || undefined, description: input.description?.trim() || undefined,
      itemType, standardCost, isStockItem: input.isStockItem ?? true,
      isPurchase: input.isPurchase ?? true, isSales: input.isSales ?? true,
    },
    include: { category: true, uom: true },
  });
  await db.auditEvent.create({ data: { tenantId: context.tenantId, actorUserId: context.userId, action: "master_data.item.created", entityType: "Item", entityId: item.id, metadata: { companyId: input.companyId, sku } } });
  return item;
}
