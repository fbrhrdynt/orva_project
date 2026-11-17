# ORVA VPS Deployment

**Target:** Ubuntu VPS, repository `/opt/orva`, systemd service `orva`, Next.js on `127.0.0.1:3200`, Nginx reverse proxy, domain `orva.febro.id`.

This is the supported deployment path. GitHub Actions runs quality checks only; it does not deploy the application. Vercel is not used as the production host.

## Requirements

- Ubuntu 22.04/24.04 or compatible
- Node.js 22.x and pnpm 10.8.0
- PostgreSQL 15+
- Git access to `fbrhrdynt/orva_project`
- Nginx and Certbot
- systemd service `orva.service`
- Application user `ubuntu`

## Environment

Create `/opt/orva/apps/web/.env` and protect it with mode 0600:

```dotenv
DATABASE_URL="postgresql://orva_app:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/orva?schema=public"
ORVA_BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
ORVA_BOOTSTRAP_ADMIN_PASSWORD="REPLACE_WITH_A_UNIQUE_PASSWORD"
```

Use a dedicated PostgreSQL role. Do not use the postgres superuser for the web application. Remove the bootstrap password after creating the first administrator.

## Deploy an approved branch

Run as the `ubuntu` application user, not root:

```bash
cd /opt/orva
chmod +x scripts/deploy-vps.sh
DEPLOY_BRANCH=feature/procurement-workspace ./scripts/deploy-vps.sh
```

The script fetches the selected branch, refuses tracked local changes, backs up the environment and previous commit, installs dependencies, generates/validates Prisma, builds Next.js, restarts systemd, and checks the local health endpoint.

For the default production branch after changes are reviewed and merged:

```bash
cd /opt/orva
DEPLOY_BRANCH=main ./scripts/deploy-vps.sh
```

## Database safety — read before first deployment

The current codebase does not yet have a reviewed Prisma baseline migration. The deployment script therefore skips schema synchronization by default.

**Do not run `prisma db push` on a database that contains production/business data.** For a brand-new, empty development database only, schema initialization can be performed after verifying the database target and taking a backup:

```bash
cd /opt/orva
pnpm db:push
```

Before production launch, create and review a baseline migration, switch deployment to `prisma migrate deploy`, and test backup/restore plus upgrade/rollback procedures. Do not use the initial schema-push flow as a production migration strategy.

## Seed data

The seed is opt-in and creates sample/demo tenant data. It is not a customer onboarding workflow. Run only in a development/demo environment:

```bash
cd /opt/orva
pnpm db:seed
```

## Health checks

```bash
curl -fsS http://127.0.0.1:3200/api/health
sudo systemctl status orva --no-pager
sudo nginx -t
curl -I https://orva.febro.id
```

A local health check does not prove DNS, TLS, or external network reachability. Verify each separately.

## Rollback

The deploy script stores the previous commit SHA and a protected environment backup under `/home/ubuntu/codex/backups/orva/`. Review the recorded SHA before checking it out. Rebuild and restart the service during a maintenance window. Git rollback does not reverse database changes; database rollback requires a tested backup/restore procedure.
