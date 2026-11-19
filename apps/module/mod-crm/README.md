# ORVA CRM Module

CRM is served through the ORVA web process and uses PostgreSQL schema `crm`.

## API foundation

- `GET /api/crm/health`: database connectivity check; no user data returned.
- `GET /api/crm/leads`: lists up to 200 leads for the authenticated organization.
- `POST /api/crm/leads`: creates a lead for the authenticated organization.

All lead endpoints require a signed HS256 JWT in the Authorization Bearer header.
The current integration contract expects claims:

- `sub`: authenticated ORVA user identifier.
- `organization_id`: UUID of the active organization.
- `permissions`: array containing `crm.leads:read`, `crm.leads:create`, or `crm:*`.
- `exp`: token expiration timestamp.
- `iss` and `aud`: checked when `ORVA_TOKEN_ISSUER` and `ORVA_TOKEN_AUDIENCE` are configured.

The secret must be shared with the ORVA identity service through a protected runtime
environment file. Never commit credentials or accept organization IDs from request bodies.

## Database

Install the module dependency with `npm install --omit=dev` in this directory.
Apply the migration as database role `orva_app`:

```bash
psql -h 127.0.0.1 -U orva_app -d orva -v ON_ERROR_STOP=1 \
  -f apps/module/mod-crm/migrations/001_create_leads.sql
```

The migration creates only schema `crm` and its leads table/indexes. It does not
modify other databases or existing schemas.

## Current limitations

This is the API foundation for Leads only. The existing CRM browser UI is still a
localStorage prototype and is not yet connected to this API. The JWT claim contract
must be matched against the ORVA identity service before enabling authenticated use.
