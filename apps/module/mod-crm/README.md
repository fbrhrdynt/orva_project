# ORVA CRM Module

CRM is served through the ORVA web process and uses PostgreSQL schema `crm`.
All CRM reads and writes are scoped to the authenticated user's active organization.

## CRM API

- `GET /api/crm/health`: database connectivity check.
- `GET /api/crm/records?entity={entity}`: paginated CRM records.
- `POST /api/crm/records`: create a CRM record.
- `PUT /api/crm/records/{uuid}`: update a CRM record.
- `DELETE /api/crm/records/{uuid}`: delete a CRM record.
- `GET /api/crm/options?kind={entity|users|related}`: tenant-scoped lookup options.
- `GET /api/crm/timeline?record_id={uuid}`: record activity history, including deleted source records.
- `GET /api/crm/reporting`: full-organization Opportunity metrics and monthly forecast.
- `POST /api/crm/leads/{uuid}/convert`: transactional Lead conversion.

## Activity Plans

An active Activity Plan must contain 1–20 steps in its `steps` JSON array. Supported triggers:

- `Lead Created`
- `Lead Qualified`
- `Opportunity Created`
- `Stage Changed`

Each step uses this shape:

```json
{
  "subject": "Call customer",
  "type": "Call",
  "delay_days": 1,
  "description": "Initial follow-up"
}
```

Supported activity types for generated steps are `Call`, `Meeting`, `Email`, and `Task`.
Delay is measured in calendar days (0–365) from trigger execution. Generated follow-ups
are saved as normal CRM Activities with status `Planned`, linked to their source record,
and visible in All Activities and the source record's Timeline.

Activity Plan execution and generated Activities are committed in the same PostgreSQL
transaction as the triggering Lead or Opportunity change. A tenant-scoped unique execution
ledger prevents duplicate generation when a request is retried. Stage changes are tracked
by transition, so a later move to another stage can run the matching plan again.

## Opportunity lifecycle and reporting

- `Won` sets probability to 100%.
- `Lost` sets probability to 0% and requires a valid tenant-owned Lost Reason.
- Normal configured stages may set the default probability from Pipeline Stages.
- Customer, Contact, Activity, owner, stage, and Lost Reason lookups are validated against
  the active organization.
- Reporting aggregates all Opportunity records for the organization, independent of UI
  pagination. It reports open pipeline, weighted forecast, Won/Lost outcomes, win rate,
  stage breakdown, and open forecast by Expected Close month.

## Database migrations

The deployment script applies CRM migrations in order, including:

- `006_crm_activity_timeline.sql`
- `007_crm_query_indexes.sql`
- `008_crm_activity_plan_runs.sql`

Run deployment only after reviewing the production preflight and taking the configured
database and source backups. The deployment script performs syntax checks and HTTP smoke
tests, but runtime behavior still needs verification against the production database.
