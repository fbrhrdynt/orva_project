# ORVA

**Business management & ERP platform for Indonesian UMKM and small businesses.**

ORVA is a modular business platform by LogiSource Digital. It is designed for owner-operated businesses, growing UMKM, and small CV/PT entities that need practical workflows without a dedicated IT team.

ORVA has its own product identity, architecture, interface, and design system. It is not an SAP product or an SAP clone.

## Product direction

- **SME-first:** straightforward screens, guided workflows, sensible defaults, and role-aware navigation.
- **Integrated:** shared company, customer, supplier, item, and transaction data across enabled modules.
- **Modular:** customers see only modules included in their license and implemented for production use.
- **Indonesian defaults:** Bahasa Indonesia, IDR, Asia/Jakarta, DD/MM/YYYY, and Indonesian number formatting; configurable per company.
- **Secure by design:** tenant isolation, verified server sessions, permission checks, audit events, and server-side subscription limits.
- **Hybrid licensing:** Shared Cloud is the default. Dedicated Cloud and Self-hosted are controlled deployment options.
- **Customer license:** ORVA / LogiSource Digital retains source code, brand, and intellectual property. Customers receive a limited right to use the subscribed service/modules under contract.

## Technology

- Next.js 15, React 19, TypeScript
- PostgreSQL and Prisma
- Tailwind CSS and the ORVA design system
- pnpm workspaces and Turborepo
- Node.js 22.x
- Ubuntu VPS, systemd, and Nginx for the self-managed deployment target

**Production hosting target:** Ubuntu VPS at `orva.febro.id`, application root `/opt/orva`, Next.js bound to `127.0.0.1:3200`, managed by systemd service `orva` and reverse-proxied by Nginx.

Vercel is not the supported production deployment target. GitHub Actions is used for repository quality checks; it does not deploy the application to the VPS.

## Current implementation status

This repository is under active development and is **not yet a production ERP release**.

Implemented foundations include:
- Authentication APIs with database-backed sessions and login throttling.
- Tenant/company context and initial access-control foundations.
- Master data APIs and workspace UI.
- Procurement foundations for purchase requisitions, purchase orders, reviews, and goods receipts.
- Subscription and plan-entitlement foundations, including platform-side provisioning and a tenant subscription/usage view.
- Ubuntu VPS deployment script and operational guide.

Some areas of the interface and seeded workspace may still contain demo/sample data. Verify each workflow against a real tenant before using it for business-critical operations. A visible menu or roadmap item does not mean the module is production-ready.

## Repository layout

- `apps/web` — ORVA web application and Prisma schema
- `docs` — product architecture, roadmap, deployment and operational guidance
- `scripts` — VPS deployment utilities
- `.github/workflows` — GitHub Actions quality checks

## Local development

Requirements: Node.js 22.x, pnpm 10.8.0, and PostgreSQL.

```bash
pnpm install
pnpm db:generate
pnpm db:validate
pnpm dev
```

Configure `apps/web/.env` using `.env.example`. Never commit credentials, session secrets, database URLs, or production environment files.

## Ubuntu VPS deployment

See [VPS deployment guide](docs/VPS-DEPLOYMENT.md).

Quick update from the approved development branch:

```bash
cd /opt/orva
DEPLOY_BRANCH=feature/procurement-workspace ./scripts/deploy-vps.sh
```

For routine production deployment, use only a reviewed and approved branch/commit. Do not run schema synchronization against a database containing production data. The current repository still requires a reviewed Prisma migration baseline and tested backup/restore procedure before production data is stored.

## Documentation

- [Product architecture](docs/PRODUCT-ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [VPS deployment](docs/VPS-DEPLOYMENT.md)

## Separate products

LS_AMT, LS_Inventory, TimesheetStudio, and LogiShell remain separate products/projects. They may integrate through explicitly designed APIs, but their source code is not absorbed into ORVA.

## License and intellectual property

ORVA is proprietary software by LogiSource Digital. Access is granted under a subscription or separate written agreement. No source-code, trademark, or intellectual-property ownership is transferred to customers.
