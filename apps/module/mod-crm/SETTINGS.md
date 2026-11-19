# ORVA Settings Center

Platform-owner administration console at `/admin`. All administration routes require an authenticated platform-owner session. Organization-specific records are scoped by `organization_id`.

## Schema migrations

- `009_enterprise_settings.sql`: organization settings, ISO currency master, exchange rates, security role/permission registry, SMTP configuration, server-action registry, automation rules, technical views and audit events.
- `010_settings_access_control.sql`: organization profile metadata, multi-organization membership role references, permission catalog, record scopes, field visibility policies, action policies and SMTP test-event history.

The deploy script applies and verifies both migrations.

## Settings capabilities

### Companies & Organizations
- List, create, edit organization profile and suspend/reactivate an organization.
- Organization profile metadata is stored in `core.organizations.profile`.
- Switch the active organization context in the Settings Center.

### Users & Access
- Create login users with scrypt password hashes (minimum 14 characters).
- Edit name and email; activate/disable login accounts.
- Grant/revoke access to enabled modules.
- Add existing users to another organization, disable/reactivate membership and remove membership without deleting the login account.
- Assign an organization-scoped security role to a membership.

### Roles & Permissions
- Create/edit/delete custom roles (system roles are protected).
- Manage permission keys from the module permission catalog.
- Configure record scopes (`all`, `own`, `team`, `organization`, `custom`).
- Configure field policies (`visible`, `readonly`, `masked`, `hidden`).
- Configure per-resource action policies.
- A role cannot be deleted while assigned to a membership.

### Organization Settings
- General, localization, inventory, sales, security, notifications, finance, purchasing, documents and integrations categories.
- Boolean settings use switches; compact two-choice values use radio controls; larger option sets use selects.
- Every saved category is audited.

### Currencies & Rates
- Create and edit ISO currency display/rounding metadata; archive/reactivate currencies.
- Create effective-dated organization-specific exchange rates and delete obsolete rate rows.
- Exchange-rate conversion is not automatically applied to financial transactions until the Finance module consumes this API.

### Outgoing Mail
- Create, edit and archive SMTP configurations.
- SMTP secrets are encrypted with AES-256-GCM when `ORVA_SETTINGS_ENCRYPTION_KEY` is configured (minimum 32 bytes).
- SMTP password is never returned by the API.
- Live SMTP handshake/authentication test and mail delivery are not implemented yet; do not treat a saved SMTP row as a verified connection.

### Automation
- Register allowlisted server-action references and edit/disable them.
- Create/edit/disable automation rules with JSON conditions and a server-action reference.
- These are configuration registries only. No arbitrary code execution is allowed, and there is no background automation execution engine yet.

### Technical Views
- Register/edit/archive JSON metadata for form, list, kanban, dashboard, calendar and report views.
- Metadata is stored safely; it is not evaluated as code and is not yet bound to the runtime renderer.

### Modules
- Manage organization-level module entitlements for modules marked available by the platform.
- This does not install or uninstall application code.

### Audit Trail
- Administrative mutations are recorded in `core.admin_audit_events`.
- Current UI displays the latest 200 events for the selected organization. Platform-global currency changes may have a null organization context.

## API

All routes below require an authenticated platform-owner session.

- `GET/POST /api/admin/organizations`; `PATCH /api/admin/organizations/:id`
- `GET/POST /api/admin/users`; `PATCH /api/admin/users/:id`; `PUT /api/admin/users/:id/modules`; `PUT /api/admin/users/:id/role`
- `GET/POST /api/admin/organizations/:id/members`; `PATCH/DELETE /api/admin/memberships/:id`
- `GET /api/admin/permissions`
- `GET/POST /api/admin/roles`; `PATCH/DELETE /api/admin/roles/:id`; `GET/PUT /api/admin/roles/:id/policies`
- `GET/POST /api/admin/currencies`; `PATCH /api/admin/currencies/:code`
- `GET/POST /api/admin/exchange-rates`; `DELETE /api/admin/exchange-rates/:id`
- `GET/POST /api/admin/smtp`; `PATCH/DELETE /api/admin/smtp/:id`
- `GET/POST /api/admin/server-actions`; `PATCH/DELETE /api/admin/server-actions/:id`
- `GET/POST /api/admin/automation`; `PATCH/DELETE /api/admin/automation/:id`
- `GET/POST /api/admin/views`; `PATCH/DELETE /api/admin/views/:id`
- `GET/PUT /api/admin/settings`
- `GET /api/admin/modules`, `GET/PUT /api/admin/organizations/:id/modules`
- `GET /api/admin/audit`

## Security boundaries / remaining work

- The role permission, record-scope, field-visibility and action-policy registries are persisted and editable, but operational API enforcement has not yet been rolled out across every module endpoint. Existing module entitlement checks remain the active authorization layer. Do not assign these role policies as a substitute for endpoint authorization until enforcement middleware is completed and tested.
- SMTP connection test and email delivery need a mail transport implementation and credentials.
- Automation execution needs an allowlisted handler runner, queue/retry semantics, idempotency and execution history.
- Technical view metadata needs a safe runtime renderer integration.
- Exchange rates need Finance transaction integration and conversion/audit policy.
- Module installation lifecycle is not implemented by the entitlement toggle.

## Deployment

Run `scripts/deploy-orva-identity.sh` as root. It backs up the database/source, applies migrations 002–010, runs syntax/smoke checks and restarts `orva.service`. Verify the service and migration tables after deployment; the repository changes alone do not prove the production database has been migrated.
