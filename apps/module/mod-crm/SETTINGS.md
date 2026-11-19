# ORVA Enterprise Settings Center

The platform owner console at `/admin` provides organization-scoped enterprise administration.

## Delivered in migration 009

- Organization settings stored as JSONB by category: `general`, `localization`, `inventory`, `sales`, `security`, and `notifications`.
- ISO 4217 currency master with symbol placement, decimal precision, and rounding configuration.
- Organization-specific exchange-rate storage.
- Security role and permission-key registry.
- SMTP server configuration with AES-256-GCM password encryption.
- Server Action registry using named application handler keys (no arbitrary script evaluation).
- Automated Action registry with constrained lifecycle events and JSON conditions.
- Technical UI View registry with JSON metadata.
- Administration audit events.

## API

All endpoints require an authenticated ORVA platform owner session.

- `GET/PUT /api/admin/settings` (PUT accepts organization_id and settings object)
- `GET/POST /api/admin/currencies`
- `GET/POST /api/admin/roles`
- `GET/POST /api/admin/smtp`
- `GET/POST /api/admin/server-actions`
- `GET/POST /api/admin/automation`
- `GET/POST /api/admin/views`
- `GET /api/admin/audit`

Organization-scoped GET endpoints require `organization_id`. SMTP passwords are never returned by API. To store a new SMTP password, configure `ORVA_SETTINGS_ENCRYPTION_KEY` in the service environment with at least 32 bytes of secret material. The first 32 bytes are used as the AES-256 key.

## Safety boundaries

- Server Actions are registered as handler references and default to disabled. The application must implement and allowlist the handler before it can be enabled.
- Automated Actions are created disabled and require an active, organization-owned Server Action.
- Technical Views store JSON metadata and resource identifiers; they do not execute user-supplied code or raw templates.
- Role permission keys are a registry at this stage. Existing module entitlements remain enforced by the current identity authorization checks; role-based endpoint enforcement must be added through a policy middleware rollout before assigning operational access to these roles.
- SMTP connection testing and sending are not yet wired to a mail transport provider.
- Exchange-rate rows have a database schema; a rate-entry UI/API workflow is a follow-up.

## Deployment

The deployment script applies migration `009_enterprise_settings.sql` after the existing CRM migrations and runs a JavaScript syntax check on the Owner Console inline script.
