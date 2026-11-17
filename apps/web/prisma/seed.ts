import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.upsert({
    where: { slug: "nusantara-industrial" },
    update: { name: "Nusantara Industrial Group", status: "ACTIVE" },
    create: { name: "Nusantara Industrial Group", slug: "nusantara-industrial" },
  });

  const company = await db.company.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "NIG" } },
    update: { name: "Nusantara Industrial Group", currency: "IDR" },
    create: { tenantId: tenant.id, code: "NIG", name: "Nusantara Industrial Group", currency: "IDR" },
  });

  const servicesCompany = await db.company.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "NSE" } },
    update: { name: "PT Nusantara Services", currency: "USD" },
    create: { tenantId: tenant.id, code: "NSE", name: "PT Nusantara Services", legalName: "PT Nusantara Services", currency: "USD" },
  });

  await db.businessUnit.upsert({
    where: { companyId_code: { companyId: company.id, code: "HQ" } },
    update: { name: "Head Office", unitType: "HEAD_OFFICE" },
    create: { companyId: company.id, code: "HQ", name: "Head Office", unitType: "HEAD_OFFICE" },
  });
  await db.businessUnit.upsert({
    where: { companyId_code: { companyId: servicesCompany.id, code: "OPS" } },
    update: { name: "Service Operations", unitType: "OPERATIONS" },
    create: { companyId: servicesCompany.id, code: "OPS", name: "Service Operations", unitType: "OPERATIONS" },
  });

  const categories = [
    { code: "RAW", name: "Raw materials" },
    { code: "MRO", name: "Maintenance, repair and operations" },
    { code: "CHEM", name: "Process chemicals" },
  ];
  for (const item of categories) {
    await db.itemCategory.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: item.code } },
      update: { name: item.name },
      create: { tenantId: tenant.id, ...item },
    });
  }

  const uoms = [
    { code: "PCS", name: "Pieces", precision: 0 },
    { code: "KG", name: "Kilogram", precision: 3 },
    { code: "DRUM", name: "Drum", precision: 0 },
    { code: "SHEET", name: "Sheet", precision: 0 },
  ];
  for (const item of uoms) {
    await db.unitOfMeasure.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: item.code } },
      update: { name: item.name, precision: item.precision },
      create: { tenantId: tenant.id, ...item },
    });
  }

  const suppliers = [
    { code: "SUP-0007", name: "PT Baja Prima Persada", city: "Cilegon" },
    { code: "SUP-0012", name: "PT Sumber Teknik Abadi", city: "Jakarta" },
    { code: "SUP-0019", name: "PT Kimia Industri Makmur", city: "Gresik" },
  ];
  for (const supplier of suppliers) {
    await db.supplier.upsert({
      where: { companyId_code: { companyId: company.id, code: supplier.code } },
      update: { name: supplier.name, city: supplier.city },
      create: { tenantId: tenant.id, companyId: company.id, ...supplier },
    });
  }

  await db.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: "WH-CKR-01" } },
    update: { name: "Cikarang Raw Materials" },
    create: { tenantId: tenant.id, companyId: company.id, code: "WH-CKR-01", name: "Cikarang Raw Materials" },
  });


  const items = [
    { sku: "RM-STEEL-PLT-06", name: "Mild steel plate 6 mm", categoryCode: "RAW", uomCode: "SHEET", itemType: "RAW_MATERIAL", standardCost: "1850000" },
    { sku: "CH-IND-045", name: "Industrial degreaser 45 L", categoryCode: "CHEM", uomCode: "DRUM", itemType: "CHEMICAL", standardCost: "1275000" },
    { sku: "MRO-BRG-220", name: "Bearing 6205-2RS", categoryCode: "MRO", uomCode: "PCS", itemType: "MRO", standardCost: "87500" },
  ];
  for (const item of items) {
    const category = await db.itemCategory.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: tenant.id, code: item.categoryCode } },
    });
    const uom = await db.unitOfMeasure.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: tenant.id, code: item.uomCode } },
    });
    await db.item.upsert({
      where: { companyId_sku: { companyId: company.id, sku: item.sku } },
      update: { name: item.name, categoryId: category.id, uomId: uom.id, standardCost: item.standardCost },
      create: {
        tenantId: tenant.id, companyId: company.id, sku: item.sku, name: item.name,
        categoryId: category.id, uomId: uom.id, itemType: item.itemType,
        standardCost: item.standardCost, isStockItem: true, isPurchase: true, isSales: false,
      },
    });
  }

  await db.tenantModuleEntitlement.upsert({ where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: "procurement" } }, update: { isIncluded: true }, create: { tenantId: tenant.id, moduleKey: "procurement", isIncluded: true } });
  await db.companyConfiguration.upsert({ where: { companyId: company.id }, update: {}, create: { companyId: company.id, locale: "id", timezone: "Asia/Jakarta", dateFormat: "dd/MM/yyyy", numberFormat: "1.234,56", fiscalYearStartMonth: 1 } });
  await db.companyModuleSetting.upsert({ where: { companyId_moduleKey: { companyId: company.id, moduleKey: "procurement" } }, update: { isEnabled: true }, create: { companyId: company.id, moduleKey: "procurement", isEnabled: true } });

  await db.companyConfiguration.upsert({
    where: { companyId: servicesCompany.id },
    update: {},
    create: { companyId: servicesCompany.id, locale: "en", timezone: "Asia/Singapore", dateFormat: "yyyy-MM-dd", numberFormat: "1,234.56", fiscalYearStartMonth: 4 },
  });
  await db.companyModuleSetting.upsert({
    where: { companyId_moduleKey: { companyId: servicesCompany.id, moduleKey: "procurement" } },
    update: { isEnabled: false },
    create: { companyId: servicesCompany.id, moduleKey: "procurement", isEnabled: false },
  });
  await db.supplier.upsert({
    where: { companyId_code: { companyId: servicesCompany.id, code: "SUP-SG-001" } },
    update: { name: "Nusantara Technical Services Pte Ltd" },
    create: { tenantId: tenant.id, companyId: servicesCompany.id, code: "SUP-SG-001", name: "Nusantara Technical Services Pte Ltd", city: "Singapore", country: "Singapore", currency: "USD" },
  });
  await db.warehouse.upsert({
    where: { companyId_code: { companyId: servicesCompany.id, code: "WH-SG-01" } },
    update: { name: "Singapore Service Depot" },
    create: { tenantId: tenant.id, companyId: servicesCompany.id, code: "WH-SG-01", name: "Singapore Service Depot" },
  });

  const plans = [
    { key: "STARTER", name: "Starter", description: "For a single small business entity.", maxUsers: 5, maxCompanies: 1, maxStorageMb: 5120, supportLevel: "STANDARD" },
    { key: "BUSINESS", name: "Business", description: "For growing businesses with multiple teams.", maxUsers: 25, maxCompanies: 5, maxStorageMb: 51200, supportLevel: "PRIORITY" },
    { key: "PROFESSIONAL", name: "Professional", description: "For multi-entity organizations and advanced operations.", maxUsers: 100, maxCompanies: 20, maxStorageMb: 256000, supportLevel: "PRIORITY" },
    { key: "ENTERPRISE", name: "Enterprise", description: "For complex groups and dedicated deployments.", maxUsers: null, maxCompanies: null, maxStorageMb: null, supportLevel: "PREMIUM" },
  ];
  for (const planData of plans) {
    const plan = await db.productPlan.upsert({
      where: { key: planData.key },
      update: { ...planData, isActive: true },
      create: { ...planData, isActive: true },
    });
    await db.productPlanModule.upsert({
      where: { planId_moduleKey: { planId: plan.id, moduleKey: "procurement" } },
      update: {},
      create: { planId: plan.id, moduleKey: "procurement" },
    });
  }

  const adminEmail = process.env.ORVA_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ORVA_BOOTSTRAP_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    let admin = await db.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      admin = await db.user.create({
        data: {
          email: adminEmail,
          name: "ORVA Workspace Administrator",
          passwordHash: await hashPassword(adminPassword),
          status: "ACTIVE",
        },
      });
    } else {
      admin = await db.user.update({
        where: { id: admin.id },
        data: { status: "ACTIVE", name: admin.name || "ORVA Workspace Administrator" },
      });
      if (!admin.passwordHash) {
        await db.user.update({
          where: { id: admin.id },
          data: { passwordHash: await hashPassword(adminPassword) },
        });
      }
    }

    const membership = await db.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
      update: { status: "ACTIVE" },
      create: { tenantId: tenant.id, userId: admin.id, status: "ACTIVE" },
    });
    await db.membershipCompanyAccess.upsert({
      where: { membershipId_companyId: { membershipId: membership.id, companyId: company.id } },
      update: {},
      create: { membershipId: membership.id, companyId: company.id },
    });
    await db.membershipCompanyAccess.upsert({
      where: { membershipId_companyId: { membershipId: membership.id, companyId: servicesCompany.id } },
      update: {},
      create: { membershipId: membership.id, companyId: servicesCompany.id },
    });
    const role = await db.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: "TENANT_ADMIN" } },
      update: { name: "Tenant Administrator", isSystem: true },
      create: { tenantId: tenant.id, key: "TENANT_ADMIN", name: "Tenant Administrator", isSystem: true },
    });
    const permissionKeys = [
      "master-data.customer.read", "master-data.customer.create",
      "master-data.supplier.read", "master-data.supplier.create",
      "master-data.item.read", "master-data.item.create", "master-data.warehouse.read", "master-data.warehouse.create",
      "procurement.purchase_order.read", "procurement.purchase_order.create",
      "procurement.purchase_order.submit", "procurement.purchase_order.approve",
      "procurement.purchase_order.reject", "procurement.goods_receipt.read", "procurement.goods_receipt.create",
      "procurement.purchase_requisition.read", "procurement.purchase_requisition.create",
      "procurement.purchase_requisition.submit", "procurement.purchase_requisition.approve",
      "procurement.purchase_requisition.reject",
      "platform.custom_fields.create",
      "company.settings.read", "company.settings.manage",
    ];
    for (const key of permissionKeys) {
      const permission = await db.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
    await db.membershipRole.upsert({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
      update: {},
      create: { membershipId: membership.id, roleId: role.id },
    });
    console.log(`Bootstrap administrator provisioned for ${adminEmail}.`);
  } else {
    console.log("Bootstrap administrator skipped. Set ORVA_BOOTSTRAP_ADMIN_EMAIL and ORVA_BOOTSTRAP_ADMIN_PASSWORD to create one.");
  }

  console.log("ORVA demo tenant and procurement master data seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
