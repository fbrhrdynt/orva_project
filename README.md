# orva.

**Enterprise Business Platform by LogiSource Digital**

ORVA is a modular enterprise resource planning and business management platform. It connects core business processes across finance, sales, procurement, supply chain, manufacturing, people, projects, and enterprise operations.

ORVA takes its enterprise process depth from the problems addressed by SAP, while developing an independent product identity, interaction model, and design system.

## Product principles

- **Integrated:** business processes share governed master data and connected transaction flows.
- **Modular:** applications are independently defined but operate within one platform.
- **Configurable:** organizations can adapt fields, forms, workflows, and reporting within controlled boundaries.
- **Enterprise-ready:** security, auditability, financial integrity, and authorization are foundational.
- **Consistent:** one identity, design system, technology standard, and platform contract.
- **Extensible:** new modules can be added without duplicating platform capabilities.

## Technology direction

- Next.js and React
- TypeScript across frontend and backend
- PostgreSQL
- Prisma
- Tailwind CSS and shadcn/ui, governed by the ORVA design system
- pnpm workspaces and Turborepo
- Redis for caching and background work where required
- Vercel for the web application; managed services/workers for workloads that do not fit the serverless runtime

Final implementation choices must be recorded in the architecture decision log.

## Versioning

ORVA uses `MAJOR.MINOR.PATCH.BUILD`.

Initial development baseline: **0.1.0.0**.

## Repository structure

The repository will evolve into a TypeScript monorepo. Platform foundations are built before business modules.

See:
- [Brand guidelines](docs/BRAND-GUIDELINES.md)
- [Product architecture](docs/PRODUCT-ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)

## Scope boundaries

The following remain separate products or personal projects and are not part of the ORVA codebase:

- LS_AMT: independently delivered client product; development and release remain under its maintainer.
- LS_Inventory: personal Raspberry Pi project.
- TimesheetStudio: personal project.
- LogiShell: private personal project.

ORVA may later integrate with external products through explicitly designed and authorized interfaces. Their source code is not absorbed into this repository.

## Development status

ORVA is in its initial foundation stage. No module should be considered production-ready until its domain model, permissions, audit requirements, business workflows, tests, and operational behavior have been reviewed.
