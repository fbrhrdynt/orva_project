import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const OWNER_EMAIL = (process.env.ORVA_PLATFORM_OWNER_EMAIL || "febroherdyanto98@gmail.com").trim().toLowerCase();
const WORKSPACE_SLUG = "febroherdyanto-admin";
const WORKSPACE_NAME = "Febro Herdyanto Admin";

async function main() {
  const user = await db.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true, email: true, status: true } });
  if (!user) throw new Error(`User ${OWNER_EMAIL} does not exist. Create the user through the normal registration/bootstrap flow first; this script never creates or resets passwords.`);
  if (user.status !== "ACTIVE") throw new Error("Platform owner account is disabled. Enable it through the approved account recovery process first.");

  const tenant = await db.tenant.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: WORKSPACE_NAME, status: "ACTIVE" },
    create: { name: WORKSPACE_NAME, slug: WORKSPACE_SLUG, status: "ACTIVE" },
    select: { id: true, name: true, slug: true },
  });

  await db.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { status: "ACTIVE" },
    create: { tenantId: tenant.id, userId: user.id, status: "ACTIVE" },
  });

  await db.platformOperator.upsert({
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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => db.$disconnect());
