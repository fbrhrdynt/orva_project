import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAuditEvent } from "@/lib/audit/write";
import {
  requireCompanyAccess,
  requirePermission,
  type VerifiedTenantContext,
} from "@/lib/tenant/access";

type TransactionClient = Prisma.TransactionClient;

type PurchaseOrderLineInput = {
  itemId?: string;
  description: string;
  quantity: string | number;
  uomCode: string;
  unitPrice: string | number;
  discountRate?: string | number;
  taxRate?: string | number;
};

type CreatePurchaseOrderInput = {
  companyId: string;
  supplierId: string;
  documentNumber: string;
  documentDate?: Date;
  expectedAt?: Date;
  currency?: string;
  paymentTermDays?: number;
  supplierReference?: string;
  deliveryAddress?: string;
  notes?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  lines: PurchaseOrderLineInput[];
};

type CreateGoodsReceiptInput = {
  companyId: string;
  purchaseOrderId: string;
  documentNumber: string;
  warehouseId: string;
  supplierDeliveryNote?: string;
  notes?: string;
  receivedAt?: Date;
  lines: Array<{ purchaseOrderLineId: string; quantity: string | number; notes?: string }>;
};

function requiredText(value: string, label: string, maxLength = 180): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label} is required and must be at most ${maxLength} characters.`);
  }
  return normalized;
}

function decimal(value: string | number, label: string): Prisma.Decimal {
  let result: Prisma.Decimal;
  try {
    result = new Prisma.Decimal(value);
  } catch {
    throw new Error(`${label} must be a valid number.`);
  }
  if (!result.isFinite()) throw new Error(`${label} must be finite.`);
  return result;
}

function positiveDecimal(value: string | number, label: string): Prisma.Decimal {
  const result = decimal(value, label);
  if (result.lte(0)) throw new Error(`${label} must be greater than zero.`);
  return result;
}

function percentage(value: string | number | undefined, label: string): Prisma.Decimal {
  const result = decimal(value ?? 0, label);
  if (result.lt(0) || result.gt(100)) throw new Error(`${label} must be between 0 and 100.`);
  return result;
}

function currencyCode(value: string | undefined): string {
  const currency = (value ?? "IDR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code.");
  return currency;
}

async function assertCompany(
  context: VerifiedTenantContext,
  companyId: string,
  client: TransactionClient | PrismaClient = db,
) {
  requireCompanyAccess(context, companyId);
  const company = await client.company.findFirst({
    where: { id: companyId, tenantId: context.tenantId, isActive: true },
    select: { id: true },
  });
  if (!company) throw new Error("Company was not found in the active tenant.");
  const [moduleSetting, entitlement] = await Promise.all([
    client.companyModuleSetting.findUnique({
      where: { companyId_moduleKey: { companyId, moduleKey: "procurement" } },
      select: { isEnabled: true },
    }),
    client.tenantModuleEntitlement.findUnique({
      where: { tenantId_moduleKey: { tenantId: context.tenantId, moduleKey: "procurement" } },
      select: { isIncluded: true },
    }),
  ]);
  if (entitlement && !entitlement.isIncluded) {
    throw new Error("Procurement is not included in this tenant subscription.");
  }
  if (moduleSetting && !moduleSetting.isEnabled) {
    throw new Error("Procurement is disabled for this company. Contact your company administrator.");
  }
}


type PurchaseRequisitionLineInput = {
  itemId?: string;
  description: string;
  quantity: string | number;
  uomCode: string;
  estimatedPrice?: string | number;
};

type CreatePurchaseRequisitionInput = {
  companyId: string;
  documentNumber: string;
  requiredAt?: Date;
  purpose?: string;
  currency?: string;
  notes?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  lines: PurchaseRequisitionLineInput[];
};

export async function listPurchaseRequisitions(
  context: VerifiedTenantContext,
  input: { companyId: string; search?: string; status?: string; take?: number },
) {
  requirePermission(context, "procurement.purchase_requisition.read");
  await assertCompany(context, input.companyId);
  const validStatuses = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;
  const selectedStatus = input.status?.trim();
  if (selectedStatus && !validStatuses.some((status) => status === selectedStatus)) {
    throw new Error("Purchase requisition status is invalid.");
  }
  const statusFilter = selectedStatus as (typeof validStatuses)[number] | undefined;
  const term = input.search?.trim();
  const where = {
    tenantId: context.tenantId,
    companyId: input.companyId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(term ? { OR: [
      { documentNumber: { contains: term, mode: "insensitive" as const } },
      { purpose: { contains: term, mode: "insensitive" as const } },
    ] } : {}),
  };
  const take = Math.min(Math.max(input.take ?? 50, 1), 100);
  const [items, total] = await db.$transaction([
    db.purchaseRequisition.findMany({
      where,
      include: { lines: true },
      orderBy: [{ requestedAt: "desc" }, { documentNumber: "desc" }],
      take,
    }),
    db.purchaseRequisition.count({ where }),
  ]);
  return { items, total };
}

export async function createPurchaseRequisition(
  context: VerifiedTenantContext,
  input: CreatePurchaseRequisitionInput,
) {
  requirePermission(context, "procurement.purchase_requisition.create");
  await assertCompany(context, input.companyId);
  const documentNumber = requiredText(input.documentNumber, "Purchase requisition number", 40).toUpperCase();
  const currency = currencyCode(input.currency);
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 500) {
    throw new Error("A purchase requisition must contain between 1 and 500 lines.");
  }
  const lineData = input.lines.map((line, index) => ({
    lineNumber: index + 1,
    itemId: line.itemId?.trim() || undefined,
    description: requiredText(line.description, `Line ${index + 1} description`),
    quantity: positiveDecimal(line.quantity, `Line ${index + 1} quantity`),
    uomCode: requiredText(line.uomCode, `Line ${index + 1} unit of measure`, 16).toUpperCase(),
    estimatedPrice: line.estimatedPrice === undefined ? undefined : decimal(line.estimatedPrice, `Line ${index + 1} estimated price`),
    currency,
  }));
  if (lineData.some((line) => line.estimatedPrice?.lt(0))) throw new Error("Estimated prices cannot be negative.");
  const itemIds = [...new Set(lineData.map((line) => line.itemId).filter((id): id is string => Boolean(id)))];
  if (itemIds.length) {
    const validItems = await db.item.findMany({
      where: { id: { in: itemIds }, tenantId: context.tenantId, companyId: input.companyId, isActive: true, isPurchase: true },
      select: { id: true },
    });
    if (validItems.length !== itemIds.length) throw new Error("One or more items are not active purchase items in this company.");
  }
  const requisition = await db.purchaseRequisition.create({
    data: {
      tenantId: context.tenantId,
      companyId: input.companyId,
      documentNumber,
      requestedById: context.userId,
      requiredAt: input.requiredAt,
      purpose: input.purpose?.trim() || undefined,
      currency,
      notes: input.notes?.trim() || undefined,
      priority: input.priority ?? "NORMAL",
      lines: { create: lineData },
    },
    include: { lines: true },
  });
  await writeAuditEvent(context, {
    action: "procurement.purchase_requisition.created",
    entityType: "PurchaseRequisition",
    entityId: requisition.id,
    metadata: { documentNumber, companyId: input.companyId, lineCount: lineData.length },
  });
  return requisition;
}

export async function submitPurchaseRequisition(context: VerifiedTenantContext, companyId: string, requisitionId: string) {
  requirePermission(context, "procurement.purchase_requisition.submit");
  await assertCompany(context, companyId);
  const id = requiredText(requisitionId, "Purchase requisition ID");
  const updated = await db.purchaseRequisition.updateMany({
    where: { id, tenantId: context.tenantId, companyId, status: "DRAFT" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("Only a draft purchase requisition in this company can be submitted.");
  const result = await db.purchaseRequisition.findFirstOrThrow({
    where: { id, tenantId: context.tenantId, companyId },
    include: { lines: true },
  });
  await writeAuditEvent(context, { action: "procurement.purchase_requisition.submitted", entityType: "PurchaseRequisition", entityId: id });
  return result;
}

export async function reviewPurchaseRequisition(
  context: VerifiedTenantContext,
  input: { companyId: string; requisitionId: string; decision: "APPROVE" | "REJECT"; reason?: string },
) {
  const permission = input.decision === "APPROVE" ? "procurement.purchase_requisition.approve" : "procurement.purchase_requisition.reject";
  requirePermission(context, permission);
  await assertCompany(context, input.companyId);
  const id = requiredText(input.requisitionId, "Purchase requisition ID");
  const reason = input.decision === "REJECT" ? requiredText(input.reason ?? "", "Rejection reason", 1000) : undefined;
  const data = input.decision === "APPROVE"
    ? { status: "APPROVED" as const, approvedAt: new Date(), approvedById: context.userId }
    : { status: "REJECTED" as const, rejectedAt: new Date(), rejectedById: context.userId, rejectionReason: reason };
  const updated = await db.purchaseRequisition.updateMany({
    where: { id, tenantId: context.tenantId, companyId: input.companyId, status: "SUBMITTED" },
    data,
  });
  if (updated.count !== 1) throw new Error("Only a submitted purchase requisition in this company can be reviewed.");
  const result = await db.purchaseRequisition.findFirstOrThrow({
    where: { id, tenantId: context.tenantId, companyId: input.companyId },
    include: { lines: true },
  });
  await writeAuditEvent(context, {
    action: input.decision === "APPROVE" ? "procurement.purchase_requisition.approved" : "procurement.purchase_requisition.rejected",
    entityType: "PurchaseRequisition",
    entityId: id,
    severity: input.decision === "REJECT" ? "WARNING" : "INFO",
    metadata: reason ? { reason } : undefined,
  });
  return result;
}

export async function listPurchaseOrders(
  context: VerifiedTenantContext,
  input: { companyId: string; search?: string; status?: string; take?: number },
) {
  requirePermission(context, "procurement.purchase_order.read");
  await assertCompany(context, input.companyId);
  const term = input.search?.trim();
  const allowedStatuses = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;
  const selectedStatus = input.status?.trim();
  if (selectedStatus && !allowedStatuses.some((status) => status === selectedStatus)) {
    throw new Error("Purchase order status is invalid.");
  }
  const statusFilter = selectedStatus as (typeof allowedStatuses)[number] | undefined;
  const where = {
    tenantId: context.tenantId,
    companyId: input.companyId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(term ? {
      OR: [
        { documentNumber: { contains: term, mode: "insensitive" as const } },
        { supplier: { name: { contains: term, mode: "insensitive" as const } } },
      ],
    } : {}),
  };
  const take = Math.min(Math.max(input.take ?? 50, 1), 100);
  const [items, total] = await db.$transaction([
    db.purchaseOrder.findMany({
      where,
      include: { supplier: { select: { id: true, code: true, name: true } }, _count: { select: { lines: true, goodsReceipts: true } } },
      orderBy: [{ documentDate: "desc" }, { documentNumber: "desc" }],
      take,
    }),
    db.purchaseOrder.count({ where }),
  ]);
  return { items, total };
}

export async function createPurchaseOrder(
  context: VerifiedTenantContext,
  input: CreatePurchaseOrderInput,
) {
  requirePermission(context, "procurement.purchase_order.create");
  await assertCompany(context, input.companyId);
  const supplierId = requiredText(input.supplierId, "Supplier");
  const documentNumber = requiredText(input.documentNumber, "Purchase order number", 40).toUpperCase();
  const currency = currencyCode(input.currency);
  const paymentTermDays = input.paymentTermDays ?? 30;
  if (!Number.isInteger(paymentTermDays) || paymentTermDays < 0 || paymentTermDays > 3650) {
    throw new Error("Payment term must be a whole number between 0 and 3650.");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 500) {
    throw new Error("A purchase order must contain between 1 and 500 lines.");
  }
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, tenantId: context.tenantId, companyId: input.companyId, isActive: true },
    select: { id: true, currency: true },
  });
  if (!supplier) throw new Error("Supplier is not active or does not belong to the selected company.");

  const lineData = input.lines.map((line, index) => {
    const description = requiredText(line.description, `Line ${index + 1} description`);
    const quantity = positiveDecimal(line.quantity, `Line ${index + 1} quantity`);
    const unitPrice = decimal(line.unitPrice, `Line ${index + 1} unit price`);
    if (unitPrice.lt(0)) throw new Error(`Line ${index + 1} unit price cannot be negative.`);
    const discountRate = percentage(line.discountRate, `Line ${index + 1} discount`);
    const taxRate = percentage(line.taxRate, `Line ${index + 1} tax`);
    const gross = quantity.mul(unitPrice);
    const discount = gross.mul(discountRate).div(100);
    const lineSubtotal = gross.minus(discount);
    const lineTax = lineSubtotal.mul(taxRate).div(100);
    const lineTotal = lineSubtotal.plus(lineTax);
    return {
      lineNumber: index + 1,
      itemId: line.itemId?.trim() || undefined,
      description,
      quantity,
      uomCode: requiredText(line.uomCode, `Line ${index + 1} unit of measure`, 16).toUpperCase(),
      unitPrice,
      discountRate,
      taxRate,
      lineSubtotal,
      lineTax,
      lineTotal,
    };
  });

  const itemIds = [...new Set(lineData.map((line) => line.itemId).filter((id): id is string => Boolean(id)))];
  if (itemIds.length) {
    const validItems = await db.item.findMany({
      where: { id: { in: itemIds }, tenantId: context.tenantId, companyId: input.companyId, isActive: true, isPurchase: true },
      select: { id: true },
    });
    if (validItems.length !== itemIds.length) throw new Error("One or more items are not active purchase items in this company.");
  }

  const subtotal = lineData.reduce((sum, line) => sum.plus(line.lineSubtotal), new Prisma.Decimal(0));
  const discountTotal = lineData.reduce((sum, line) => sum.plus(line.quantity.mul(line.unitPrice).minus(line.lineSubtotal)), new Prisma.Decimal(0));
  const taxTotal = lineData.reduce((sum, line) => sum.plus(line.lineTax), new Prisma.Decimal(0));
  const grandTotal = subtotal.plus(taxTotal);

  const purchaseOrder = await db.purchaseOrder.create({
    data: {
      tenantId: context.tenantId,
      companyId: input.companyId,
      supplierId,
      documentNumber,
      documentDate: input.documentDate,
      expectedAt: input.expectedAt,
      currency,
      paymentTermDays,
      supplierReference: input.supplierReference?.trim() || undefined,
      deliveryAddress: input.deliveryAddress?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      priority: input.priority ?? "NORMAL",
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      lines: { create: lineData },
    },
    include: { supplier: { select: { code: true, name: true } }, lines: true },
  });
  await writeAuditEvent(context, {
    action: "procurement.purchase_order.created",
    entityType: "PurchaseOrder",
    entityId: purchaseOrder.id,
    metadata: { documentNumber, companyId: input.companyId, supplierId, lineCount: lineData.length, grandTotal: grandTotal.toString(), currency },
  });
  return purchaseOrder;
}

export async function submitPurchaseOrder(context: VerifiedTenantContext, companyId: string, purchaseOrderId: string) {
  requirePermission(context, "procurement.purchase_order.submit");
  await assertCompany(context, companyId);
  const id = requiredText(purchaseOrderId, "Purchase order ID");
  const updated = await db.purchaseOrder.updateMany({
    where: { id, tenantId: context.tenantId, companyId, status: "DRAFT" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("Only a draft purchase order in this company can be submitted.");
  const result = await db.purchaseOrder.findFirstOrThrow({
    where: { id, tenantId: context.tenantId, companyId },
    include: { supplier: true, lines: true },
  });
  await writeAuditEvent(context, { action: "procurement.purchase_order.submitted", entityType: "PurchaseOrder", entityId: id });
  return result;
}

export async function reviewPurchaseOrder(
  context: VerifiedTenantContext,
  input: { companyId: string; purchaseOrderId: string; decision: "APPROVE" | "REJECT"; reason?: string },
) {
  const permission = input.decision === "APPROVE" ? "procurement.purchase_order.approve" : "procurement.purchase_order.reject";
  requirePermission(context, permission);
  await assertCompany(context, input.companyId);
  const id = requiredText(input.purchaseOrderId, "Purchase order ID");
  const reason = input.decision === "REJECT" ? requiredText(input.reason ?? "", "Rejection reason", 1000) : undefined;
  const data = input.decision === "APPROVE"
    ? { status: "APPROVED" as const, approvedAt: new Date(), approvedById: context.userId }
    : { status: "REJECTED" as const, rejectedAt: new Date(), rejectedById: context.userId, rejectionReason: reason };
  const updated = await db.purchaseOrder.updateMany({
    where: { id, tenantId: context.tenantId, companyId: input.companyId, status: "SUBMITTED" },
    data,
  });
  if (updated.count !== 1) throw new Error("Only a submitted purchase order in this company can be reviewed.");
  const result = await db.purchaseOrder.findFirstOrThrow({
    where: { id, tenantId: context.tenantId, companyId: input.companyId },
    include: { supplier: true, lines: true },
  });
  await writeAuditEvent(context, {
    action: input.decision === "APPROVE" ? "procurement.purchase_order.approved" : "procurement.purchase_order.rejected",
    entityType: "PurchaseOrder",
    entityId: id,
    severity: input.decision === "REJECT" ? "WARNING" : "INFO",
    metadata: reason ? { reason } : undefined,
  });
  return result;
}

export async function createGoodsReceipt(context: VerifiedTenantContext, input: CreateGoodsReceiptInput) {
  requirePermission(context, "procurement.goods_receipt.create");
  await assertCompany(context, input.companyId);
  const documentNumber = requiredText(input.documentNumber, "Goods receipt number", 40).toUpperCase();
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 500) {
    throw new Error("A goods receipt must contain between 1 and 500 lines.");
  }
  const warehouse = await db.warehouse.findFirst({
    where: { id: input.warehouseId, tenantId: context.tenantId, companyId: input.companyId, isActive: true },
    select: { id: true },
  });
  if (!warehouse) throw new Error("Warehouse is not active or does not belong to the selected company.");

  const ids = input.lines.map((line) => requiredText(line.purchaseOrderLineId, "Purchase order line ID"));
  if (new Set(ids).size !== ids.length) throw new Error("A purchase order line may only appear once per receipt.");
  const quantities = input.lines.map((line, index) => positiveDecimal(line.quantity, `Receipt line ${index + 1} quantity`));

  const receipt = await db.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, tenantId: context.tenantId, companyId: input.companyId, status: "APPROVED" },
      select: { id: true, documentNumber: true },
    });
    if (!order) throw new Error("Goods can only be received against an approved purchase order.");

    const orderLines = await tx.purchaseOrderLine.findMany({
      where: { id: { in: ids }, purchaseOrderId: order.id },
      select: { id: true, quantity: true, receivedQty: true, item: { select: { id: true, isStockItem: true } } },
    });
    if (orderLines.length !== ids.length) throw new Error("One or more receipt lines do not belong to the selected purchase order.");

    for (let i = 0; i < ids.length; i += 1) {
      const orderLine = orderLines.find((line) => line.id === ids[i]);
      if (!orderLine) throw new Error("Purchase order line could not be found.");
      const remaining = orderLine.quantity.minus(orderLine.receivedQty);
      if (quantities[i].gt(remaining)) throw new Error("Receipt quantity exceeds the outstanding purchase order quantity.");
    }

    const created = await tx.goodsReceipt.create({
      data: {
        tenantId: context.tenantId,
        companyId: input.companyId,
        purchaseOrderId: order.id,
        documentNumber,
        receivedAt: input.receivedAt,
        receivedById: context.userId,
        warehouseId: warehouse.id,
        supplierDeliveryNote: input.supplierDeliveryNote?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        lines: {
          create: input.lines.map((line, index) => ({
            purchaseOrderLineId: ids[index],
            quantity: quantities[index],
            notes: line.notes?.trim() || undefined,
          })),
        },
      },
      include: { lines: true },
    });

    for (let i = 0; i < ids.length; i += 1) {
      const receivedLine = orderLines.find((line) => line.id === ids[i]);
      if (receivedLine?.item?.isStockItem) {
        await tx.stockLedgerEntry.create({
          data: {
            tenantId: context.tenantId, companyId: input.companyId, itemId: receivedLine.item.id,
            warehouseId: warehouse.id, movementType: "RECEIPT", quantity: quantities[i],
            referenceType: "GOODS_RECEIPT", referenceId: created.id,
            idempotencyKey: `goods-receipt:${created.id}:${ids[i]}`, actorUserId: context.userId,
            notes: input.notes?.trim() || undefined,
          },
        });
      }
      await tx.purchaseOrderLine.update({
        where: { id: ids[i] },
        data: { receivedQty: { increment: quantities[i] } },
      });
    }

    const refreshed = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: order.id },
      select: { quantity: true, receivedQty: true },
    });
    const fullyReceived = refreshed.every((line) => line.receivedQty.gte(line.quantity));
    const partiallyReceived = refreshed.some((line) => line.receivedQty.gt(0));
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: fullyReceived ? "RECEIVED" : partiallyReceived ? "PARTIALLY_RECEIVED" : "APPROVED" },
    });
    return created;
  });

  await writeAuditEvent(context, {
    action: "procurement.goods_receipt.created",
    entityType: "GoodsReceipt",
    entityId: receipt.id,
    metadata: { documentNumber, purchaseOrderId: input.purchaseOrderId, lineCount: receipt.lines.length },
  });
  return receipt;
}
