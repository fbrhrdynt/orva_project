#!/usr/bin/env bash
set -Eeuo pipefail
BACKUP_FILE=""
trap 'echo "[ERROR] Gagal pada baris $LINENO. Backup: $BACKUP_FILE" >&2' ERR
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
[[ "$EUID" -eq 0 ]] || { echo "Jalankan: sudo bash scripts/deploy-orva-identity.sh"; exit 1; }
for cmd in git node npm psql pg_dump systemctl curl; do command -v "$cmd" >/dev/null 2>&1 || { echo "Command tidak ditemukan: $cmd"; exit 1; }; done
[[ -d "$APP_DIR/.git" && -f "$ENV_FILE" ]] || { echo "Repository atau environment ORVA tidak ditemukan"; exit 1; }
systemctl is-active --quiet "$SERVICE" || { echo "$SERVICE tidak aktif"; exit 1; }
[[ -z "$(git -C "$APP_DIR" status --porcelain)" ]] || { echo "Working tree tidak bersih. Hentikan deploy."; exit 1; }
echo "[1/8] Fetch source"
git -C "$APP_DIR" fetch origin "$BRANCH"
TARGET_COMMIT="$(git -C "$APP_DIR" rev-parse FETCH_HEAD)"
[[ -n "$TARGET_COMMIT" ]] || { echo "Commit target tidak ditemukan"; exit 1; }
echo "[2/8] Backup database dan repository"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
install -d -o ubuntu -g ubuntu -m 750 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/orva-before-identity-$STAMP.dump"
sudo -u postgres pg_dump -Fc --no-owner --dbname="$DB_NAME" > "$BACKUP_FILE"
chown ubuntu:ubuntu "$BACKUP_FILE"
chmod 640 "$BACKUP_FILE"
git -C "$APP_DIR" bundle create "$BACKUP_DIR/orva-before-identity-$STAMP.bundle" --all
chown ubuntu:ubuntu "$BACKUP_DIR/orva-before-identity-$STAMP.bundle"
chmod 640 "$BACKUP_DIR/orva-before-identity-$STAMP.bundle"
echo "[3/8] Update source dan dependency"
git -C "$APP_DIR" checkout -B "$BRANCH" "$TARGET_COMMIT"
git -C "$APP_DIR" reset --hard "$TARGET_COMMIT"
cd "$APP_DIR/apps/module/mod-crm"
npm install --omit=dev --no-audit --no-fund --package-lock=false
echo "[4/8] Migration Identity"
set -a
source "$ENV_FILE"
set +a
export PGPASSWORD="$(printf '%s' "$PGPASSWORD_B64" | base64 -d)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/apps/module/mod-crm/migrations/002_create_core_identity.sql"
unset PGPASSWORD
echo "[5/8] Bootstrap ORVA Owner"
OWNER_COUNT="$(PGPASSWORD="$(printf '%s' "$PGPASSWORD_B64" | base64 -d)" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc "SELECT count(*) FROM core.users WHERE is_platform_owner=true")"
if [[ "$OWNER_COUNT" == "0" ]]; then
  cd "$APP_DIR"
  node scripts/bootstrap-orva-admin.mjs
else
  echo "ORVA Owner sudah ada; bootstrap dilewati."
fi
unset PGPASSWORD_B64 ORVA_AUTH_SECRET
echo "[6/8] Permission dan restart"
chown -R orva:orva "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 750 {} +
find "$APP_DIR" -type f -exec chmod 640 {} +
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE"
echo "[7/8] Verifikasi"
LOGIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login")"
HEALTH="$(curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/crm/health")"
[[ "$LOGIN_CODE" == "200" ]]
printf '%s' "$HEALTH" | grep -q '"database":"connected"'
echo "Login page HTTP: $LOGIN_CODE"
echo "CRM health: $HEALTH"
echo "[8/8] Deploy selesai"
echo "Commit: $TARGET_COMMIT"
echo "Backup: $BACKUP_FILE"
echo "Login: https://$(hostname -f)/login"
echo "Session: 8 jam, HttpOnly + Secure + SameSite=Lax"
