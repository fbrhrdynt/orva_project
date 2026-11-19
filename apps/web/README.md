# ORVA Web Shell

Single-folder ORVA deployment. One Node.js service serves the App Launcher, company dashboard and CRM module:

- `/` — App Launcher
- `/dashboard` — Company Dashboard
- `/crm` — CRM module

Run locally:
```bash
cd apps/web && PORT=3200 node server.mjs
```

Deployment script: `scripts/deploy-vps.sh`. It creates `/opt/orva`, creates a dedicated `orva` Linux service account, configures a read-only GitHub deploy key, and installs one systemd service. On first run it prints the public key and exits so it can be added to repository Deploy Keys; run it again after adding the key.

CRM currently has browser-local prototype CRUD. It is not yet multi-user or production data storage. Authentication, server-side API, database, authorization and audit trail are next development milestones.
