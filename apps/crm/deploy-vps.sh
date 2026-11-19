#!/usr/bin/env bash
set -Eeuo pipefail
trap 'status=$?; echo "[ERROR] Deployment failed at line ${LINENO} (exit ${status})" >&2; exit "$status"' ERR

REPO="git@github.com:fbrhrdynt/orva_project.git"
BRANCH="main"
APP="/opt/orva-crm"
BACKUPS="/home/ubuntu/codex/backups/orva-crm"
SERVICE="orva-crm"
PORT="3200"
USER_NAME="ubuntu"
KEY="/home/ubuntu/.ssh/orva_deploy_key"
TMP="$(mktemp -d /tmp/orva-crm.XXXXXX)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

for command_name in git node systemctl curl tar; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "[ERROR] Missing command: $command_name" >&2; exit 1; }
done
id "$USER_NAME" >/dev/null 2>&1 || { echo "[ERROR] User $USER_NAME not found" >&2; exit 1; }
test -r "$KEY" || { echo "[ERROR] GitHub deploy key unavailable: $KEY" >&2; exit 1; }

install -d -o "$USER_NAME" -g "$USER_NAME" "$BACKUPS" "$APP"

echo "[1/6] Fetch production source from apps/crm"
GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/repo"
SRC="$TMP/repo/apps/crm"
test -s "$SRC/app.html" \
  && test -s "$SRC/server.mjs" \
  && test -s "$SRC/package.json" || { echo "[ERROR] Production CRM source missing in apps/crm" >&2; exit 1; }

echo "[2/6] Validate source"
node --check "$SRC/server.mjs"
node --input-type=module -e "import('./$SRC/server.mjs').catch(() => process.exit(1))" >/dev/null 2>&1 && { echo "[ERROR] Server unexpectedly started during validation" >&2; exit 1; } || true
node -e "const p=require('$SRC/package.json'); if(p.type!=='module') process.exit(1)"

echo "[3/6] Backup current release"
if [[ -d "$APP/public" || -f "$APP/server.mjs" || -f "$APP/package.json" ]]; then
  BACKUP="$BACKUPS/orva-crm-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$BACKUP" -C "$APP" public server.mjs package.json 2>/dev/null || {
    echo "[ERROR] Backup failed; refusing to continue" >&2
    exit 1
  }
  echo "[OK] Backup: $BACKUP"
fi

echo "[4/6] Stage production release"
mkdir -p "$TMP/release/public"
install -m 0644 "$SRC/app.html" "$TMP/release/public/index.html"
install -m 0644 "$SRC/server.mjs" "$TMP/release/server.mjs"
install -m 0644 "$SRC/package.json" "$TMP/release/package.json"
test -s "$TMP/release/public/index.html"

echo "[5/6] Install and start systemd service"
systemctl stop "$SERVICE" 2>/dev/null || true
install -d "$APP"
rm -rf "$APP/public.new"
cp -a "$TMP/release/public" "$APP/public.new"
rm -rf "$APP/public"
mv "$APP/public.new" "$APP/public"
install -m 0644 "$TMP/release/server.mjs" "$APP/server.mjs"
install -m 0644 "$TMP/release/package.json" "$APP/package.json"
chown -R "$USER_NAME:$USER_NAME" "$APP"

cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=ORVA CRM
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$APP
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$PORT
ExecStart=$(command -v node) $APP/server.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=$APP

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo "[6/6] Verify service and HTTP health"
healthy=0
for attempt in $(seq 1 20); do
  if systemctl is-active --quiet "$SERVICE" \
    && curl --fail --silent --show-error "http://127.0.0.1:$PORT/" >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
  echo "[ERROR] CRM health check failed. Recent service logs:" >&2
  journalctl -u "$SERVICE" -n 80 --no-pager >&2 || true
  systemctl status "$SERVICE" --no-pager --full >&2 || true
  exit 1
fi

echo "[SUCCESS] ORVA CRM is healthy"
echo "Service : $SERVICE"
echo "Port    : $PORT"
echo "Install : $APP"
echo "Source  : apps/crm"
echo "Backup  : $BACKUPS"
systemctl --no-pager --full status "$SERVICE" | head -n 12
