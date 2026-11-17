import { Prisma, type InventoryMovementType } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireCompanyAccess, requirePermission, type VerifiedTenantContext } from "@/lib/tenant/access";

function positive(value: string | number, label: string) {
  let amount: Prisma.Decimal;
  try { amount = new Prisma.Decimal(value); } catch { throw new Error(`${label} must be a valid decimal.`); }
  if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 4) throw new Error(`${label} must be greater than zero with up to four decimal places.`);
  return amount;
}

async function assertWarehouse(context: VerifiedTenantContext, companyId: string, warehouseId: string) {
  const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, tenantId: context.tenantId, companyId, isActive: true }, select: { id: true } });
  if (!warehouse) throw new Error("Warehouse is not active or does not belong to this company.");
}

export async function listStockBalances(context: VerifiedTenantContext, companyId: string, search = "") {
  requirePermission(context, "inventory.stock.read");
  requireCompanyAccess(context, companyId);
  const company = await db.company.findFirst({ where: { id: companyId, tenantId: context.tenantId, isActive: true }, select: { id: true } });
  if (!company) throw new Error("Company was not found.");
  const term = search.trim();
  const items = await db.item.findMany({
    where: { tenantId: context.tenantId, companyId, isActive: true, isStockItem: true,
      ...(term ? { OR: [{ sku: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }] } : {}) },
    select: { id: true, sku: true, name: true, uom: { select: { code: true, name: true } } },
    orderBy: { name: "asc" }, take: 200,
  });
  const warehouses = await db.warehouse.findMany({ where: { tenantId: context.tenantId, companyId, isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });
  const balances = await db.stockLedgerEntry.groupBy({
    by: ["itemId", "warehouseId"], where: { tenantId: context.tenantId, companyId, itemId: { in: items.map(x => x.id) } },
    _sum: { quantity: true },
  });
  const itemMap = new Map(items.map(x => [x.id, x]));
  const warehouseMap = new Map(warehouses.map(x => [x.id, x]));
  return { items: balances.map(row => ({ item: itemMap.get(row.itemId), warehouse: warehouseMap.get(row.warehouseId), quantity: row._sum.quantity?.toString() ?? "0" }))
    .filter(row => row.item && row.warehouse), warehouses, itemCount: items.length };
}

type MovementInput = { companyId: string; itemId: string; warehouseId: string; quantity: string | number; movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT"; unitCost?: string | number; notes?: string; idempotencyKey?: string };
export async function postStockAdjustment(context: VerifiedTenantContext, input: MovementInput) {
  requirePermission(context, "inventory.stock.adjust");
  requireCompanyAccess(context, input.companyId);
  const quantity = positive(input.quantity, "Quantity");
  await assertWarehouse(context, input.companyId, input.warehouseId);
  const item = await db.item.findFirst({ where: { id: input.itemId, tenantId: context.tenantId, companyId: input.companyId, isActive: true, isStockItem: true }, select: { id: true, sku: true } });
  if (!item) throw new Error("Stock item was not found in this company.");
  const unitCost = input.unitCost === undefined ? undefined : positive(input.unitCost, "Unit cost");
  const idempotencyKey = input.idempotencyKey?.trim() || undefined;
  if (idempotencyKey && idempotencyKey.length > 120) throw new Error("Idempotency key is too long.");
  const entry = await db.$transaction(async tx => {
    if (idempotencyKey) {
      const prior = await tx.stockLedgerEntry.findFirst({ where: { tenantId: context.tenantId, idempotencyKey } });
      if (prior) return prior;
    }
    if (input.movementType === "ADJUSTMENT_OUT") {
      const current = await tx.stockLedgerEntry.aggregate({ where: { tenantId: context.tenantId, companyId: input.companyId, itemId: item.id, warehouseId: input.warehouseId }, _sum: { quantity: true } });
      if ((current._sum.quantity ?? new Prisma.Decimal(0)).lt(quantity)) throw new Error("Insufficient stock for this adjustment.");
    }
    return tx.stockLedgerEntry.create({ data: {
      tenantId: context.tenantId, companyId: input.companyId, itemId: item.id, warehouseId: input.warehouseId,
      movementType: input.movementType as InventoryMovementType,
      quantity: input.movementType === "ADJUSTMENT_OUT" ? quantity.negated() : quantity,
      unitCost, referenceType: "MANUAL_ADJUSTMENT", idempotencyKey, notes: input.notes?.trim() || undefined, actorUserId: context.userId,
    } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await writeAuditEvent(context, { action: "inventory.stock.adjusted", entityType: "StockLedgerEntry", entityId: entry.id, metadata: { itemId: item.id, warehouseId: input.warehouseId, movementType: input.movementType, quantity: quantity.toString() } });
  return entry;
}

export async function transferStock(context: VerifiedTenantContext, input: { companyId: string; itemId: string; fromWarehouseId: string; toWarehouseId: string; quantity: string | number; notes?: string; idempotencyKey?: string }) {
  requirePermission(context, "inventory.stock.transfer");
  requireCompanyAccess(context, input.companyId);
  if (input.fromWarehouseId === input.toWarehouseId) throw new Error("Source and destination warehouses must be different.");
  const quantity = positive(input.quantity, "Transfer quantity");
  await Promise.all([assertWarehouse(context, input.companyId, input.fromWarehouseId), assertWarehouse(context, input.companyId, input.toWarehouseId)]);
  const item = await db.item.findFirst({ where: { id: input.itemId, tenantId: context.tenantId, companyId: input.companyId, isActive: true, isStockItem: true }, select: { id: true } });
  if (!item) throw new Error("Stock item was not found in this company.");
  const key = input.idempotencyKey?.trim() || undefined;
  if (key && key.length > 100) throw new Error("Idempotency key is too long.");
  const result = await db.$transaction(async tx => {
    if (key) {
      const prior = await tx.stockLedgerEntry.findFirst({ where: { tenantId: context.tenantId, idempotencyKey: key } });
      if (prior) return { source: prior, destination: null, duplicate: true };
    }
    const current = await tx.stockLedgerEntry.aggregate({ where: { tenantId: context.tenantId, companyId: input.companyId, itemId: item.id, warehouseId: input.fromWarehouseId }, _sum: { quantity: true } });
    if ((current._sum.quantity ?? new Prisma.Decimal(0)).lt(quantity)) throw new Error("Insufficient stock in the source warehouse.");
    const referenceId = crypto.randomUUID();
    const source = await tx.stockLedgerEntry.create({ data: {
      tenantId: context.tenantId, companyId: input.companyId, itemId: item.id, warehouseId: input.fromWarehouseId,
      movementType: "TRANSFER_OUT", quantity: quantity.negated(), referenceType: "WAREHOUSE_TRANSFER", referenceId,
      idempotencyKey: key, notes: input.notes?.trim() || undefined, actorUserId: context.userId,
    } });
    const destination = await tx.stockLedgerEntry.create({ data: {
      tenantId: context.tenantId, companyId: input.companyId, itemId: item.id, warehouseId: input.toWarehouseId,
      movementType: "TRANSFER_IN", quantity, referenceType: "WAREHOUSE_TRANSFER", referenceId,
      notes: input.notes?.trim() || undefined, actorUserId: context.userId,
    } });
    return { source, destination, duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!result.duplicate) await writeAuditEvent(context, { action: "inventory.stock.transferred", entityType: "StockLedgerEntry", entityId: result.source.id, metadata: { itemId: item.id, fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId, quantity: quantity.toString(), referenceId: result.source.referenceId } });
  return result;
}
