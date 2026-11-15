export type VerifiedTenantContext = {
  userId: string;
  tenantId: string;
  membershipId: string;
  companyIds: readonly string[];
  permissions: ReadonlySet<string>;
};

export class AccessDeniedError extends Error {
  readonly statusCode = 403;
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** Accept only a context created by a trusted server-side session resolver. */
export function requirePermission(context: VerifiedTenantContext, permission: string): void {
  if (!context.permissions.has(permission)) throw new AccessDeniedError();
}

/** Prevents cross-company access even when a record ID is known. */
export function requireCompanyAccess(context: VerifiedTenantContext, companyId: string): void {
  if (!context.companyIds.includes(companyId)) throw new AccessDeniedError("Company access is not granted.");
}

export function tenantWhere<T extends Record<string, unknown>>(
  context: VerifiedTenantContext,
  where: T = {} as T
): T & { tenantId: string } {
  return { ...where, tenantId: context.tenantId };
}
