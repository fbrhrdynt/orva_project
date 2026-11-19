#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "[ERROR] Deployment gagal pada baris $LINENO. Production belum tentu rollback otomatis; periksa log." >&2' ERR

APP_DIR="/opt/orva"
BRANCH="feat/crm-api-foundation"
BACKUP_DIR="/home/ubuntu/backups"
SERVICE="orva.service"
ENV_DIR="/etc/orva"
ENV_FILE="$ENV_DIR/crm.env"
DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN_FILE="$DROPIN_DIR/20-crm-environment.conf"
DB_NAME="orva"
DB_USER="orva_app"
DB_HOST="127.0.0.1"
DB_PORT="5432"

[[ "$EUID" -eq 0 ]] || { echo "Jalankan dengan sudo: sudo bash scripts/deploy-crm-production.sh"; exit 1; }
for cmd in git node npm psql pg_dump systemctl curl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Command tidak ditemukan: $cmd"; exit 1; }
done
[[ -d "$APP_DIR/.git" ]] || { echo "Repository tidak ditemukan di $APP_DIR"; exit 1; }
id orva >/dev/null 2>&1 || { echo "User service orva tidak ditemukan"; exit 1; }
systemctl is-active --quiet "$SERVICE" || { echo "$SERVICE tidak aktif; hentikan deploy dan audit service terlebih dahulu"; exit 1; }

echo "[1/9] Validasi repository dan branch"
git -C "$APP_DIR" diff --quiet || { echo "Working tree memiliki perubahan tracked. Backup/review manual dahulu."; exit 1; }
git -C "$APP_DIR" diff --cached --quiet || { echo "Index Git tidak bersih. Hentikan deployment."; exit 1; }
[[ -z "$(git -C "$APP_DIR" status --porcelain)" ]] || { echo "Working tree tidak bersih. Hentikan deployment."; exit 1; }
PREVIOUS_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD)"
git -C "$APP_DIR" fetch origin "$BRANCH"
TARGET_COMMIT="$(git -C "$APP_DIR" rev-parse FETCH_HEAD)"
[[ -n "$TARGET_COMMIT" ]] || { echo "Commit target tidak ditemukan"; exit 1; }

echo "[2/9] Siapkan backup"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
install -d -o ubuntu -g ubuntu -m 750 "$BACKUP_DIR"
DB_BACKUP="$BACKUP_DIR/orva-before-crm-$STAMP.dump"
sudo -u postgres pg_dump -Fc --no-owner --dbname="$DB_NAME" --file="$DB_BACKUP"
chown ubuntu:ubuntu "$DB_BACKUP"
chmod 640 "$DB_BACKUP"
git -C "$APP_DIR" bundle create "$BACKUP_DIR/orva-repo-before-crm-$STAMP.bundle" --all
chown ubuntu:ubuntu "$BACKUP_DIR/orva-repo-before-crm-$STAMP.bundle"
chmod 640 "$BACKUP_DIR/orva-repo-before-crm-$STAMP.bundle"

echo "[3/9] Siapkan kredensial runtime"
read -rsp "Password PostgreSQL untuk orva_app: " DB_PASSWORD
echo
[[ -n "$DB_PASSWORD" ]] || { echo "Password tidak boleh kosong"; exit 1; }
export PGPASSWORD="$DB_PASSWORD"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -Atc "SELECT current_user" | grep -qx "$DB_USER"
DB_PASSWORD_B64="$(printf '%s' "$DB_PASSWORD" | base64 -w0)"
unset DB_PASSWORD PGPASSWORD
if [[ -f "$ENV_FILE" ]]; then
  cp -a "$ENV_FILE" "$BACKUP_DIR/orva-crm-env-before-$STAMP"
  OLD_AUTH_SECRET="$(sed -n 's/^ORVA_AUTH_SECRET=//p' "$ENV_FILE" | head -n1)"
else
  OLD_AUTH_SECRET=""
fi
AUTH_SECRET="$OLD_AUTH_SECRET"
if [[ -z "$AUTH_SECRET" ]]; then AUTH_SECRET="$(openssl rand -hex 48)"; fi
install -d -m 750 -o root -g orva "$ENV_DIR"
umask 077
cat > "$ENV_FILE" <<EOF
PGHOST=$DB_HOST
PGPORT=$DB_PORT
PGDATABASE=$DB_NAME
PGUSER=$DB_USER
PGPASSWORD_B64=$DB_PASSWORD_B64
ORVA_AUTH_SECRET=$AUTH_SECRET
PGPOOL_MAX=10
NODE_ENV=production
EOF
chown root:orva "$ENV_FILE"
chmod 640 "$ENV_FILE"
unset DB_PASSWORD_B64 AUTH_SECRET OLD_AUTH_SECRET

echo "[4/9] Update source dari branch terpilih"
git -C "$APP_DIR" checkout "$BRANCH"
git -C "$APP_DIR" reset --hard "$TARGET_COMMIT"

echo "[5/9] Install dependency CRM"
cd "$APP_DIR/apps/module/mod-crm"
npm install --omit=dev --no-audit --no-fund

echo "[6/9] Jalankan migration CRM"
export PGPASSWORD="$(printf '%s' "$(sed -n 's/^PGPASSWORD_B64=//p' "$ENV_FILE")" | base64 -d)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -f "$APP_DIR/apps/module/mod-crm/migrations/001_create_leads.sql"
unset PGPASSWORD

echo "[7/9] Pasang systemd environment drop-in"
install -d -m 755 "$DROPIN_DIR"
cat > "$DROPIN_FILE" <<EOF
[Service]
EnvironmentFile=$ENV_FILE
EOF
chmod 644 "$DROPIN_FILE"
chown -R orva:orva "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 750 {} +
find "$APP_DIR" -type f -exec chmod 640 {} +
find "$APP_DIR" -type f \( -name '*.mjs' -o -name '*.js' \) -exec chmod 640 {} +

echo "[8/9] Restart service dan verifikasi"
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE"
PORT="$(systemctl show "$SERVICE" -p Environment --value | tr ' ' '\n' | sed -n 's/^PORT=//p' | tail -n1)"
[[ -n "$PORT" ]] || PORT="3210"
curl --fail --silent --show-error "http://127.0.0.1:$PORT/" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$PORT/crm" >/dev/null
HEALTH="$(curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/crm/health")"
printf '%s\n' "$HEALTH" | grep -q '"database":"connected"'

echo "[9/9] Selesai"
echo "Commit sebelumnya : $PREVIOUS_COMMIT"
echo "Commit production : $TARGET_COMMIT"
echo "Database backup   : $DB_BACKUP"
echo "Service            : $(systemctl is-active "$SERVICE")"
echo "CRM health         : $HEALTH"
echo "Catatan: endpoint Leads tetap membutuhkan JWT dari ORVA Identity. UI CRM belum dimigrasikan dari localStorage."
