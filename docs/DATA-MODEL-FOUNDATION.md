# ORVA Data Model Foundation

**Scope:** initial platform identity and organization model. This is a schema foundation, not a production-ready authentication implementation.

## Entities

- `Tenant` is the customer isolation boundary.
- `User` is a global identity and may belong to multiple tenants.
- `TenantMembership` links a user to a tenant and carries membership state.
- `Company` is a legal entity inside one tenant.
- `BusinessUnit` models branch, department, site, or other company unit using a parent-child hierarchy.
- `MembershipCompanyAccess` grants explicit company access within a tenant membership.
- `Role`, `Permission`, `RolePermission`, and `MembershipRole` provide tenant-owned role assignment and reusable permission keys.

## Security invariants

1. Resolve the authenticated user on the server. Never accept a user ID from a browser request as proof of identity.
2. Resolve the active tenant from a verified session and membership. Never trust a client-supplied tenant ID without checking membership.
3. Every company-scoped query must constrain both tenant and company access in the same server-side operation.
4. A role assignment is valid only when the role belongs to the same tenant as the membership. Enforce this in service logic and tests; relational foreign keys alone do not prove this cross-table invariant.
5. Suspended tenants, disabled users, and inactive memberships must be rejected before domain operations.
6. Authentication, invitation, membership, role, company-access, and permission changes must be audited before production use.

## Deliberate omissions

Authentication provider integration, password policy, sessions, MFA, invitation delivery, audit event storage, row-level security, and tenant provisioning workflows are not implemented by this schema alone. They are subsequent platform work and must be completed before production use.

## Database setup

1. Provision a PostgreSQL database.
2. Copy `.env.example` to `.env` for local development and set `DATABASE_URL`.
3. Install Prisma CLI and client in the web workspace before running migrations.
4. Generate a reviewed initial migration; do not use `db push` as a production deployment strategy.
5. Apply migrations through a controlled release pipeline with a database backup and rollback plan.
