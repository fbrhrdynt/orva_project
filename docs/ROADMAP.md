# ORVA Roadmap

**Starting version:** 0.1.0.0

## Phase 0 — Product and engineering foundation
- Brand tokens and shared UI foundations
- Monorepo structure and code quality gates
- Architecture decision records
- CI checks and environment configuration
- Database and migration conventions

## Phase 1 — Platform foundation
- Authentication and session management
- Tenant and company model
- Organization structure
- Roles, permissions, and scoped authorization
- Application launcher and module registry
- Audit foundation

## Phase 2 — Shared business capabilities
- Master data governance
- Document service
- Notification service
- Workflow and approval engine
- Import/export framework
- Reporting foundation
- ORVA Studio foundations

## Phase 3 — Core ERP
- Finance and Accounting
- Procurement
- Inventory and Warehouse
- Sales and Customer Management

## Phase 4 — Enterprise operations
- Manufacturing and Quality
- Supply Chain and Logistics
- Asset and Maintenance Management
- Project and Service Management
- Human Capital Management

## Phase 5 — Extended business applications
- Marketing and Commerce
- Productivity and Collaboration
- Business Intelligence
- Industry solutions and integrations

## Release policy

A phase is not complete because screens exist. Completion requires domain rules, authorization, tenant isolation, migrations, audit behavior, tests, documentation, and operational readiness.

Version format: MAJOR.MINOR.PATCH.BUILD.
- MAJOR: stable platform generation / breaking platform contract.
- MINOR: compatible feature release.
- PATCH: compatible defect or security fix.
- BUILD: build or packaging revision.

The 0.x line is pre-stable. 1.0.0.0 is reserved for the first production-ready stable release.
