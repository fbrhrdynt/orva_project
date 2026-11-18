import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const OWNER_EMAIL = (process.env.ORVA_PLATFORM_OWNER_EMAIL || "").trim().toLowerCase();
const WORKSPACE_SLUG = "febroherdyanto-admin";
const WORKSPACE_NAME = "Febro Herdyanto Admin";

async function main() {
  if (!OWNER_EMAIL || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(OWNER_EMAIL)) {
    throw new Error("Set ORVA_PLATFORM_OWNER_EMAIL to the exact existing account email before running this bootstrap.");
  }
  const user = await db.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true, email: true, status: true } });
  if (!user) throw new Error(`User ${OWNER_EMAIL} does not exist. Create the user through the normal registration/bootstrap flow first; this script never creates or resets passwords.`);
  if (user.status !== "ACTIVE") throw new Error("Platform owner account is disabled. Enable it through the approved account recovery process first.");

  await db.$transaction(async (tx) => {
  const tenant = await tx.tenant.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: WORKSPACE_NAME, status: "ACTIVE" },
    create: { name: WORKSPACE_NAME, slug: WORKSPACE_SLUG, status: "ACTIVE" },
    select: { id: true, name: true, slug: true },
  });

  await tx.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { status: "ACTIVE" },
    create: { tenantId: tenant.id, userId: user.id, status: "ACTIVE" },
  });

  await tx.platformOperator.upsert({
    where: { userId: user.id },
    update: { role: "OWNER", isActive: true },
    create: { userId: user.id, role: "OWNER", isActive: true },
  });

  console.log(JSON.stringify({
    result: "Platform Owner provisioned",
    email: user.email,
    role: "OWNER",
    workspaceName: tenant.name,
    workspaceId: tenant.slug,
    loginWorkspaceId: tenant.slug,
    note: "Existing password retained. No customer business records were read or modified.",
  }, null, 2));
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => db.$disconnect());
