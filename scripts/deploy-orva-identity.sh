#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="/opt/orva"
BRANCH="feat/crm-api-foundation"
SERVICE="orva.service"
ENV_FILE="/etc/orva/crm.env"
BACKUP_DIR="/home/ubuntu/backups"
DB_NAME="orva"
DB_USER="orva_app"
DB_HOST="127.0.0.1"
DB_PORT="5432"
PORT="3210"
BACKUP_FILE=""
PREVIOUS_COMMIT=""
DEPLOY_STARTED=0
rollback_source() {
  local exit_code=$?
  trap - EXIT ERR
  if [[ "$exit_code" -ne 0 && "$DEPLOY_STARTED" -eq 1 && -n "$PREVIOUS_COMMIT" ]]; then
    echo "[ROLLBACK] Deployment gagal. Mengembalikan source ke $PREVIOUS_COMMIT" >&2
    git -C "$APP_DIR" reset --hard "$PREVIOUS_COMMIT" || true
    systemctl restart "$SERVICE" || true
  fi
  if [[ "$exit_code" -ne 0 ]]; then
    echo "[ERROR] Deployment gagal (exit $exit_code). Backup database: ${BACKUP_FILE:-belum dibuat}" >&2
  fi
  exit "$exit_code"
}
trap rollback_source EXIT
[[ "$EUID" -eq 0 ]] || { echo "Jalankan: sudo bash scripts/deploy-orva-identity.sh"; exit 1; }
for cmd in git node npm psql pg_dump pg_restore systemctl curl base64 sudo; do command -v "$cmd" >/dev/null 2>&1 || { echo "Command tidak ditemukan: $cmd"; exit 1; }; done
[[ -d "$APP_DIR/.git" && -f "$ENV_FILE" ]] || { echo "Repository /opt/orva atau $ENV_FILE tidak ditemukan"; exit 1; }
systemctl is-active --quiet "$SERVICE" || { echo "$SERVICE tidak aktif"; exit 1; }
[[ -z "$(git -C "$APP_DIR" status --porcelain)" ]] || { echo "Working tree /opt/orva tidak bersih. Deploy dibatalkan."; exit 1; }
echo "[1/9] Fetch branch dan validasi konfigurasi"
git -C "$APP_DIR" fetch origin "$BRANCH"
TARGET_COMMIT="$(git -C "$APP_DIR" rev-parse FETCH_HEAD)"
PREVIOUS_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD)"
[[ "$TARGET_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "Commit target tidak valid"; exit 1; }
set -a
source "$ENV_FILE"
set +a
[[ -n "${PGPASSWORD_B64:-}" && -n "${ORVA_AUTH_SECRET:-}" ]] || { echo "PGPASSWORD_B64 / ORVA_AUTH_SECRET tidak tersedia"; exit 1; }
[[ "${#ORVA_AUTH_SECRET}" -ge 32 ]] || { echo "ORVA_AUTH_SECRET minimal 32 karakter"; exit 1; }
echo "[2/9] Backup database dan source"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
install -d -o ubuntu -g ubuntu -m 750 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/orva-before-identity-$STAMP.dump"
sudo -u postgres pg_dump -Fc --no-owner --dbname="$DB_NAME" > "$BACKUP_FILE"
[[ -s "$BACKUP_FILE" ]] || { echo "Database backup kosong"; exit 1; }
pg_restore --list "$BACKUP_FILE" >/dev/null
chown ubuntu:ubuntu "$BACKUP_FILE"; chmod 640 "$BACKUP_FILE"
git -C "$APP_DIR" bundle create "$BACKUP_DIR/orva-before-identity-$STAMP.bundle" --all
chown ubuntu:ubuntu "$BACKUP_DIR/orva-before-identity-$STAMP.bundle"; chmod 640 "$BACKUP_DIR/orva-before-identity-$STAMP.bundle"
echo "[3/9] Update source"
git -C "$APP_DIR" checkout -B "$BRANCH" "$TARGET_COMMIT"
git -C "$APP_DIR" reset --hard "$TARGET_COMMIT"
DEPLOY_STARTED=1
echo "[4/9] Install dependency dan cek sintaks"
cd "$APP_DIR/apps/module/mod-crm"
npm install --omit=dev --no-audit --no-fund --package-lock=false
node --check api/auth.mjs
node --check api/identity.mjs
node --check api/server.mjs
node --check "$APP_DIR/apps/web/server.mjs"
node --check "$APP_DIR/scripts/bootstrap-orva-admin.mjs"
echo "[5/9] Jalankan migration Identity dan CRM"
export PGPASSWORD="$(printf '%s' "$PGPASSWORD_B64" | base64 -d)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/apps/module/mod-crm/migrations/002_create_core_identity.sql"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/apps/module/mod-crm/migrations/003_create_crm_records.sql"
unset PGPASSWORD
echo "[6/9] Bootstrap ORVA Owner pertama jika belum ada"
OWNER_COUNT="$(PGPASSWORD="$(printf '%s' "$PGPASSWORD_B64" | base64 -d)" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc "SELECT count(*) FROM core.users WHERE is_platform_owner=true")"
if [[ "$OWNER_COUNT" == "0" ]]; then
  cd "$APP_DIR"
  node scripts/bootstrap-orva-admin.mjs
else
  echo "ORVA Owner sudah terdaftar; bootstrap dilewati."
fi
OWNER_COUNT="$(PGPASSWORD="$(printf '%s' "$PGPASSWORD_B64" | base64 -d)" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc "SELECT count(*) FROM core.users WHERE is_platform_owner=true AND status='active'")"
[[ "$OWNER_COUNT" -ge 1 ]] || { echo "Tidak ditemukan ORVA Owner aktif"; exit 1; }
# Re-run idempotent CRM seed after the first owner exists.
export PGPASSWORD="$(printf '%s' "$PGPASSWORD_B64" | base64 -d)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/apps/module/mod-crm/migrations/003_create_crm_records.sql"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/apps/module/mod-crm/migrations/004_crm_search_and_pagination.sql"
unset PGPASSWORD
unset PGPASSWORD_B64 ORVA_AUTH_SECRET
echo "[7/9] Permission dan restart service"
chown -R orva:orva "$APP_DIR"
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE"
echo "[8/9] Smoke test"
LOGIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login")"
AUTH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/me")"
ROOT_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")"
ADMIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/admin")"
CRM_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/crm")"
HEALTH="$(curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/crm/health")"
[[ "$LOGIN_CODE" == "200" && "$AUTH_CODE" == "401" && "$ROOT_CODE" == "302" && "$ADMIN_CODE" == "302" && "$CRM_CODE" == "302" ]] || { echo "Smoke test gagal: login=$LOGIN_CODE auth=$AUTH_CODE root=$ROOT_CODE admin=$ADMIN_CODE crm=$CRM_CODE"; exit 1; }
printf '%s' "$HEALTH" | grep -q '"database":"connected'
echo "Login=$LOGIN_CODE, auth=$AUTH_CODE, protected routes=$ROOT_CODE/$ADMIN_CODE/$CRM_CODE"
echo "CRM health: $HEALTH"
echo "[9/9] Deploy selesai"
echo "Commit production : $TARGET_COMMIT"
echo "Commit sebelumnya: $PREVIOUS_COMMIT"
echo "Database backup   : $BACKUP_FILE"
echo "Source bundle     : $BACKUP_DIR/orva-before-identity-$STAMP.bundle"
echo "Login             : https://$(hostname -f)/login"
echo "Owner Console     : https://$(hostname -f)/admin"
echo "Session           : 8 jam, HttpOnly + Secure + SameSite=Lax"
echo "CRM records       : PostgreSQL, tenant-scoped + demo seed"
DEPLOY_STARTED=0
trap - EXIT ERR
