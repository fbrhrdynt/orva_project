# ORVA Platform Security Baseline

## Trust boundaries

- Browser input is untrusted, including tenant slugs, company IDs, role IDs, and user IDs.
- Authentication must produce a verified server-side session before `resolveTenantContext` is called.
- `resolveTenantContext` rejects disabled users, inactive memberships, and suspended tenants, and only grants active companies belonging to the resolved tenant.
- Role assignments are checked against tenant ownership when permissions are assembled.
- Domain services must call `requirePermission` and, for company-scoped operations, `requireCompanyAccess` before reading or mutating records.

## Data access rules

- Use `tenantWhere(context, where)` for tenant-scoped Prisma filters, or include `tenantId` explicitly in compound filters.
- Never query a tenant-owned record by its primary key alone.
- Never accept actor or tenant identity from request JSON.
- Write security-sensitive actions through `writeAuditEvent`.
- Custom field definitions are tenant-scoped and validated before persistence. Runtime values still require type validation at the domain boundary.

## Current implementation boundary

The repository contains schema and server-side primitives. A production authentication provider, session cookie lifecycle, MFA, invitation workflow, database migrations, row-level security, rate limiting, and end-to-end security tests remain required before external production use. Do not expose tenant provisioning or administration endpoints until authentication and authorization are connected.
