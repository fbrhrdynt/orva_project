# ORVA VPS Deployment

Target: Ubuntu VPS, repository `/opt/orva`, systemd service `orva`, Next.js port `3200`, Nginx reverse proxy, domain `orva.febro.id`.

## One-time prerequisites

- Node.js 22.x
- pnpm 10.8.0
- PostgreSQL 15 or newer, with an empty ORVA application database
- GitHub deploy key configured for this repository
- Nginx and Certbot configured separately
- systemd service `orva.service` configured to run Next.js on `127.0.0.1:3200`

## Environment

Create `/opt/orva/apps/web/.env` with a PostgreSQL URL. Keep credentials out of Git:

```dotenv
DATABASE_URL="postgresql://orva_app:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/orva?schema=public"
```

Use a dedicated PostgreSQL role with access only to the ORVA database. Never use the postgres superuser for the web application.

## Initial deploy / update

Run as the `ubuntu` application user. The script fetches the selected branch (default `main`), installs dependencies, validates/generates Prisma, builds Next.js, restarts systemd, and checks the health endpoint. It skips database schema synchronization unless explicitly requested.

```bash
cd /opt/orva
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

For the first setup only, after confirming the target database is empty, initialize its schema explicitly:

```bash
INITIALIZE_DATABASE=1 ./scripts/deploy-vps.sh
```

Routine application updates do not push schema changes. To deploy a feature branch for preview:

```bash
DEPLOY_BRANCH=feature/procurement-workspace ./scripts/deploy-vps.sh
```

The script stores a timestamped copy of the environment file (mode 0600) and the previous Git commit under `/home/ubuntu/codex/backups/orva/`. It refuses to deploy over uncommitted tracked changes.

## Database safety

The repository currently uses `prisma db push` for the initial development schema because the complete platform baseline migration has not yet been generated. This synchronizes the database schema directly and does not create a reviewed migration history. Use only with a newly created, empty development database. Do not use this command to update an existing production database with business data.

Before production launch, generate and review a complete baseline migration, replace `db push` with `prisma migrate deploy`, and test backup/restore plus upgrade/rollback procedures.

The demo seed is opt-in and creates the `nusantara-industrial` demo tenant and master data. It does not create an authentication user or enable login:

```bash
cd /opt/orva
pnpm db:seed
```

## Checks

```bash
curl -fsS http://127.0.0.1:3200/api/health
sudo systemctl status orva --no-pager
sudo nginx -t
curl -I https://orva.febro.id
```

A successful local health check does not prove that DNS, TLS, or external network filtering permits access. Confirm each separately.

## Rollback

The deployment script records the previous commit SHA but does not automatically roll back database schema changes. To roll back application code, inspect the previous SHA in the latest backup directory, check it out in a controlled maintenance window, rebuild, and restart the service. Database rollback requires a tested database backup/restore; do not assume Git rollback reverses database changes.
