#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/orva}"
APP_DIR="${APP_DIR:-$APP_ROOT/apps/web}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/ubuntu/codex/backups/orva}"
BRANCH="${DEPLOY_BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-orva}"
PORT="${PORT:-3200}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:$PORT/api/health}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

log() { printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ "$EUID" -ne 0 ]] || fail "Run as the ubuntu application user, not root. Use sudo only for system package/service commands."
[[ -d "$APP_ROOT/.git" ]] || fail "Repository not found at $APP_ROOT"
[[ -f "$APP_DIR/package.json" ]] || fail "Next.js workspace not found at $APP_DIR"
command -v pnpm >/dev/null 2>&1 || fail "pnpm is not installed"
command -v node >/dev/null 2>&1 || fail "Node.js is not installed"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"

mkdir -p "$BACKUP_ROOT"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

log "Checking working tree"
git -C "$APP_ROOT" diff --quiet || fail "Tracked local changes exist. Commit/stash them before deploying."
git -C "$APP_ROOT" diff --cached --quiet || fail "Staged local changes exist. Commit/stash them before deploying."

log "Backing up application configuration"
if [[ -f "$APP_DIR/.env" ]]; then
  install -m 600 "$APP_DIR/.env" "$BACKUP_DIR/web.env"
fi
git -C "$APP_ROOT" rev-parse HEAD > "$BACKUP_DIR/previous-commit.txt"

log "Fetching $BRANCH"
git -C "$APP_ROOT" fetch --prune origin
git -C "$APP_ROOT" checkout "$BRANCH"
git -C "$APP_ROOT" pull --ff-only origin "$BRANCH"

log "Installing production dependencies"
cd "$APP_ROOT"
pnpm install --no-frozen-lockfile

log "Validating environment"
[[ -s "$APP_DIR/.env" ]] || fail "Missing $APP_DIR/.env. Configure DATABASE_URL before database commands."
grep -q '^DATABASE_URL=' "$APP_DIR/.env" || fail "DATABASE_URL is not configured in $APP_DIR/.env"

log "Generating Prisma client and validating schema"
pnpm db:generate
pnpm db:validate

log "Applying schema to the configured database"
log "This uses prisma db push for the initial development schema. It is not a migration history."
pnpm db:push

log "Creating production build"
pnpm build

log "Restarting systemd service"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl is-active --quiet "$SERVICE_NAME" || fail "Systemd service $SERVICE_NAME did not become active."

log "Health check"
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error "$HEALTH_URL" > "$BACKUP_DIR/health.json"; then
    cat "$BACKUP_DIR/health.json"
    log "Deployment completed. Previous commit: $(cat "$BACKUP_DIR/previous-commit.txt")"
    exit 0
  fi
  sleep 2
done

log "Health check failed. Recent service logs:"
sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager || true
fail "Deployment failed health check. Inspect logs before retrying."
