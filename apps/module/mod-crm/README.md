# ORVA CRM Module

Standalone module inside the ORVA monorepository. Served by the ORVA CRM Node service; deployment keeps the entire repository under `/opt/orva`.

## Local development

```bash
cd apps/module/mod-crm
PORT=3210 HOST=127.0.0.1 node server.mjs
```

Open `http://127.0.0.1:3210`.

## Current scope
- CRM overview and navigation groups for Leads, Customers, Contacts, Opportunities, Activities, Sales Forecast, and Configuration.
- Local prototype CRUD for leads, customers, contacts, opportunities, activities, and configuration records.
- CSV export, search, opportunity pipeline/kanban view, responsive navigation.

## Important
This is the first functional UI module prototype. Records are currently stored in browser localStorage and are browser/device-specific. The dashboard trend series are illustrative. Do not use as multi-user production CRM until authentication, authorization, API-backed persistence, validation, audit history, and database migrations are implemented.
