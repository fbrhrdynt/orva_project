# ORVA Product Architecture

**Baseline:** 0.1.0.0  
**Status:** Initial architecture direction

## 1. Product definition

ORVA is a modular enterprise ERP and business management platform owned by LogiSource Digital. It is designed for multiple industries and supports integrated end-to-end business processes.

SAP is the primary reference for enterprise process depth and control. Odoo is a secondary reference for modular application breadth. ORVA must retain its own product identity and user experience.

## 2. Platform layers

### Platform core
- Identity and authentication
- Tenant and organization management
- Authorization and policy enforcement
- Module registry and entitlement
- Master data governance
- Workflow and approval engine
- Customization framework (ORVA Studio)
- Reporting and analytics foundation
- Notifications
- Document services
- Audit and compliance
- Integration hub
- Localization and configuration

### Business application domains
- Finance and Accounting
- Sales and Customer Management
- Procurement and Supplier Management
- Inventory and Warehouse Management
- Supply Chain and Logistics
- Manufacturing and Quality
- Human Capital Management
- Project and Service Management
- Asset and Maintenance Management
- Marketing and Commerce
- Productivity and Collaboration
- Business Intelligence

### Industry solutions
Industry-specific capabilities are delivered as extensions or configurations over shared platform capabilities. They must not fork core business logic unnecessarily.

## 3. Architectural principles

- Begin with a modular monolith with explicit domain boundaries.
- Use TypeScript across application and service code.
- Use PostgreSQL as the transactional relational database.
- Keep domain logic out of UI components.
- Enforce tenant and company scope on the server for every protected operation.
- Use explicit service contracts between domains.
- Use transactional outbox/event patterns for reliable cross-domain effects where needed.
- Keep audit records for sensitive and financially relevant actions.
- Do not allow modules to bypass shared authorization, audit, or master-data policies.
- Prefer synchronous domain services for immediate transactional invariants; use background workers for asynchronous and long-running work.

## 4. Multi-tenancy and organization

The data model must distinguish:
- Tenant: customer organization boundary.
- Legal entity/company: accounting and legal boundary.
- Business unit, branch, and department: organizational structures.
- User: identity that may be granted access to multiple companies.
- Role and permission: authorization within defined scope.

Tenant isolation is mandatory. Company-level access must be explicit. Consolidated group reporting must be permission-controlled.

### Company-specific configuration and product variation

A tenant may contain multiple legal entities. Each company is independently configurable while sharing the tenant identity, security boundary, and platform services.

Company-specific capabilities include:
- Module enablement and module configuration per company.
- Legal entity profile, tax registration, base currency, locale, time zone, date and number formats.
- Fiscal year start and week start conventions.
- Company-specific business units, warehouses, customers, suppliers, items, and operational records.
- Company-specific custom field definitions in addition to tenant-wide custom fields.
- Explicit user-to-company access. A user may access one, several, or all companies in a tenant according to assigned grants.

Module enablement is not authorization by itself. Every module endpoint must enforce both the user's permission and the selected company's module entitlement. Tenant-wide entitlements may further restrict which modules a company can enable. Company settings must never allow a user to grant themselves company access or permissions.

The default module configuration is a safe platform baseline. Administrators may enable or disable modules independently for each company without creating separate application forks.

## 5. Module contract

Every module must define:
- Unique module key and display name.
- Version and platform compatibility.
- Domain ownership and dependencies.
- Database migrations.
- Permissions and data scopes.
- Navigation and launcher metadata.
- Workflows and business events.
- Audit requirements.
- Reports and exports.
- API/service contracts.
- Automated tests and operational documentation.

## 6. Cross-module business processes

Initial enterprise process map:
- Procure-to-Pay
- Order-to-Cash
- Record-to-Report
- Plan-to-Produce
- Hire-to-Retire
- Plan-to-Maintain
- Project-to-Profit

Each process must define ownership, state transitions, accounting impact, authorization, exception handling, and traceability.

## 7. Technology direction

- Next.js / React
- TypeScript
- Node.js services
- PostgreSQL
- Prisma
- Tailwind CSS and shadcn/ui, customized to ORVA brand standards
- pnpm workspaces and Turborepo
- Redis for appropriate caching and queues
- Vercel for web delivery, with managed database and separate worker/runtime services as required

Vercel is a deployment platform, not the entire backend architecture. Long-running jobs, queue consumers, scheduled workloads, and specialized services must run in a suitable managed runtime.

## 8. Explicit exclusions

LS_AMT, LS_Inventory, TimesheetStudio, and LogiShell are not source modules in this repository. Any future integration must use a reviewed interface and explicit authorization.


## Commercial product and licensing model

ORVA is a licensed ERP product. The default commercial offer is a recurring subscription; perpetual use is a negotiated enterprise option, not an automatic transfer of source code or intellectual property.

### Offerings
- **Shared Cloud:** multi-tenant SaaS operated by ORVA. Subscription includes platform hosting, standard updates, backups, and support level defined by contract.
- **Dedicated Cloud:** isolated customer deployment and database, with recurring hosting/operations fees plus implementation.
- **Self-hosted Enterprise:** customer-operated infrastructure under a perpetual or term license. The contract defines permitted entities, users, modules, environments, update rights, support, audit rights, and termination obligations.

### Commercial separation
- ProductPlan is the sellable package catalogue and defines user, company, storage, support and module limits.
- ProductPlanModule defines modules included in each plan.
- Subscription records the tenant's contracted plan, deployment mode, billing interval, price, contract dates, renewal and payment-provider references.
- BillingInvoice records invoice lifecycle and payment reconciliation references.
- TenantModuleEntitlement is the effective tenant-level feature grant; it must be synchronized from the active subscription by trusted billing/platform services, never directly by tenant administrators.
- CompanyModuleSetting allows each legal entity to disable included modules locally. It cannot grant a module absent from the tenant entitlement.
- Company configuration remains independent from subscription commercial terms.

### Subscription lifecycle
Trial -> Active -> Past due -> Suspended or Active after settlement. Cancellation can take effect immediately or at period end. Expired or suspended subscriptions must be blocked by server-side entitlement checks, with a controlled read-only/grace policy defined by contract. Billing webhooks must be signature-verified and idempotent. Never trust browser-submitted prices, plan IDs, payment status, or entitlement changes.

### Limits and metering
Enforce user, company and storage limits on the server at the operation that creates the resource or consumes storage. Show usage and limit to tenant administrators. Platform operators may override limits only with an audited action and documented reason.

### License and IP policy
A subscription grants a limited right to use ORVA during the contracted period. It does not transfer ownership of the ORVA source code, brand, or intellectual property. Self-hosted licensing requires signed license claims, offline verification policy, deployment identity, expiry/grace behavior, and a documented renewal process. Do not implement a client-editable or plaintext license key as the security boundary.

### Commercial price design
Prices are configured commercially and are not hardcoded in application code. Quotes may combine recurring plan fees, additional seats/entities/storage, implementation, migration, integrations, training, dedicated infrastructure, and premium support. Taxes, currency, billing entity, payment terms and service levels are contractual and jurisdiction-specific.
