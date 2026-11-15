import { db } from "@/lib/db";
import type { VerifiedTenantContext } from "@/lib/tenant/access";

/**
 * `authenticatedUserId` must come from a verified server session, never from
 * query parameters, headers supplied by the browser, or a request body.
 */
export async function resolveTenantContext(
  authenticatedUserId: string,
  tenantSlug: string
): Promise<VerifiedTenantContext | null> {
  const membership = await db.tenantMembership.findFirst({
    where: {
      userId: authenticatedUserId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      tenant: { slug: tenantSlug, status: "ACTIVE" }
    },
    include: {
      tenant: true,
      companyAccess: { where: { company: { isActive: true } }, include: { company: true } },
      roleAssignments: {
        include: { role: { include: { permissions: { include: { permission: true } } } } }
      }
    }
  });

  if (!membership || membership.tenant.status !== "ACTIVE") return null;

  const permissions = new Set<string>();
  for (const assignment of membership.roleAssignments) {
    if (assignment.role.tenantId !== membership.tenantId) continue;
    for (const item of assignment.role.permissions) permissions.add(item.permission.key);
  }

  return {
    userId: authenticatedUserId,
    tenantId: membership.tenantId,
    membershipId: membership.id,
    companyIds: membership.companyAccess
      .filter((access: { company: { tenantId: string }; companyId: string }) => access.company.tenantId === membership.tenantId)
      .map((access) => access.companyId),
    permissions
  };
}
