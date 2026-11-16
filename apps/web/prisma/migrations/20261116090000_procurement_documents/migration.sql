-- CreateEnum
CREATE TYPE "ProcurementDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "ProcurementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "companyId" TEXT NOT NULL,
 "documentNumber" TEXT NOT NULL, "requestedById" TEXT NOT NULL,
 "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "requiredAt" TIMESTAMP(3),
 "purpose" TEXT, "status" "ProcurementDocumentStatus" NOT NULL DEFAULT 'DRAFT',
 "priority" "ProcurementPriority" NOT NULL DEFAULT 'NORMAL', "currency" TEXT NOT NULL DEFAULT 'IDR',
 "notes" TEXT, "submittedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3), "approvedById" TEXT,
 "rejectedAt" TIMESTAMP(3), "rejectedById" TEXT, "rejectionReason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseRequisitionLine" (
 "id" TEXT NOT NULL, "requisitionId" TEXT NOT NULL, "lineNumber" INTEGER NOT NULL,
 "itemId" TEXT, "description" TEXT NOT NULL, "quantity" DECIMAL(20,4) NOT NULL,
 "uomCode" TEXT NOT NULL, "estimatedPrice" DECIMAL(20,4), "currency" TEXT NOT NULL DEFAULT 'IDR',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PurchaseRequisitionLine_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseOrder" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "companyId" TEXT NOT NULL, "supplierId" TEXT NOT NULL,
 "documentNumber" TEXT NOT NULL, "documentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expectedAt" TIMESTAMP(3), "currency" TEXT NOT NULL DEFAULT 'IDR', "exchangeRate" DECIMAL(20,8) NOT NULL DEFAULT 1,
 "status" "ProcurementDocumentStatus" NOT NULL DEFAULT 'DRAFT', "priority" "ProcurementPriority" NOT NULL DEFAULT 'NORMAL',
 "paymentTermDays" INTEGER NOT NULL DEFAULT 30, "supplierReference" TEXT, "deliveryAddress" TEXT, "notes" TEXT,
 "subtotal" DECIMAL(20,4) NOT NULL DEFAULT 0, "discountTotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
 "taxTotal" DECIMAL(20,4) NOT NULL DEFAULT 0, "grandTotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
 "submittedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3), "approvedById" TEXT,
 "rejectedAt" TIMESTAMP(3), "rejectedById" TEXT, "rejectionReason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseOrderLine" (
 "id" TEXT NOT NULL, "purchaseOrderId" TEXT NOT NULL, "lineNumber" INTEGER NOT NULL,
 "itemId" TEXT, "description" TEXT NOT NULL, "quantity" DECIMAL(20,4) NOT NULL,
 "receivedQty" DECIMAL(20,4) NOT NULL DEFAULT 0, "uomCode" TEXT NOT NULL,
 "unitPrice" DECIMAL(20,4) NOT NULL, "discountRate" DECIMAL(9,4) NOT NULL DEFAULT 0,
 "taxRate" DECIMAL(9,4) NOT NULL DEFAULT 0, "lineSubtotal" DECIMAL(20,4) NOT NULL,
 "lineTax" DECIMAL(20,4) NOT NULL, "lineTotal" DECIMAL(20,4) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GoodsReceipt" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "companyId" TEXT NOT NULL, "purchaseOrderId" TEXT NOT NULL,
 "documentNumber" TEXT NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "receivedById" TEXT NOT NULL, "warehouseId" TEXT NOT NULL, "supplierDeliveryNote" TEXT, "notes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GoodsReceiptLine" (
 "id" TEXT NOT NULL, "goodsReceiptId" TEXT NOT NULL, "purchaseOrderLineId" TEXT NOT NULL,
 "quantity" DECIMAL(20,4) NOT NULL, "notes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseRequisition_tenantId_documentNumber_key" ON "PurchaseRequisition"("tenantId","documentNumber");
CREATE INDEX "PurchaseRequisition_tenantId_companyId_status_requestedAt_idx" ON "PurchaseRequisition"("tenantId","companyId","status","requestedAt");
CREATE INDEX "PurchaseRequisition_tenantId_requestedById_idx" ON "PurchaseRequisition"("tenantId","requestedById");
CREATE UNIQUE INDEX "PurchaseRequisitionLine_requisitionId_lineNumber_key" ON "PurchaseRequisitionLine"("requisitionId","lineNumber");
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_documentNumber_key" ON "PurchaseOrder"("tenantId","documentNumber");
CREATE INDEX "PurchaseOrder_tenantId_companyId_status_documentDate_idx" ON "PurchaseOrder"("tenantId","companyId","status","documentDate");
CREATE INDEX "PurchaseOrder_tenantId_supplierId_documentDate_idx" ON "PurchaseOrder"("tenantId","supplierId","documentDate");
CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_lineNumber_key" ON "PurchaseOrderLine"("purchaseOrderId","lineNumber");
CREATE UNIQUE INDEX "GoodsReceipt_tenantId_documentNumber_key" ON "GoodsReceipt"("tenantId","documentNumber");
CREATE INDEX "GoodsReceipt_tenantId_companyId_receivedAt_idx" ON "GoodsReceipt"("tenantId","companyId","receivedAt");
CREATE INDEX "GoodsReceipt_tenantId_purchaseOrderId_idx" ON "GoodsReceipt"("tenantId","purchaseOrderId");
CREATE INDEX "GoodsReceiptLine_goodsReceiptId_idx" ON "GoodsReceiptLine"("goodsReceiptId");
CREATE INDEX "GoodsReceiptLine_purchaseOrderLineId_idx" ON "GoodsReceiptLine"("purchaseOrderLineId");
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
