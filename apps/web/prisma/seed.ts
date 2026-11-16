import { PrismaClient } from "@prisma/client";

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

  console.log("ORVA demo tenant and procurement master data seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
