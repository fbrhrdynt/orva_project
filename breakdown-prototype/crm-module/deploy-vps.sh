#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "[ERROR] Deployment failed at line $LINENO" >&2' ERR
REPO="git@github.com:fbrhrdynt/orva_project.git"
BRANCH="main"
APP="/opt/orva-crm"
BACKUPS="/home/ubuntu/codex/backups/orva-crm"
SERVICE="orva-crm"
PORT="3200"
USER_NAME="ubuntu"
TMP="$(mktemp -d /tmp/orva-crm.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
for c in git node systemctl curl; do command -v "$c" >/dev/null || { echo "Missing command: $c"; exit 1; }; done
id "$USER_NAME" >/dev/null
install -d -o "$USER_NAME" -g "$USER_NAME" "$BACKUPS" "$APP"
echo "[1/5] Fetch source"
git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/repo"
SRC="$TMP/repo/breakdown-prototype/crm-module"
test -s "$SRC/app.html" && test -s "$SRC/server.mjs" || { echo "CRM source files are missing"; exit 1; }
echo "[2/5] Backup current release"
if [[ -d "$APP/public" ]]; then tar -czf "$BACKUPS/orva-crm-$(date +%Y%m%d-%H%M%S).tar.gz" -C "$APP" public server.mjs 2>/dev/null || true; fi
echo "[3/5] Stage files"
mkdir -p "$TMP/release/public"
install -m 0644 "$SRC/app.html" "$TMP/release/public/index.html"
install -m 0644 "$SRC/server.mjs" "$TMP/release/server.mjs"
install -m 0644 "$SRC/package.json" "$TMP/release/package.json"
node --check "$TMP/release/server.mjs"
echo "[4/5] Install and start systemd service"
systemctl stop "$SERVICE" 2>/dev/null || true
rm -rf "$APP/public.new"
cp -a "$TMP/release/public" "$APP/public.new"
rm -rf "$APP/public"
mv "$APP/public.new" "$APP/public"
install -m 0644 "$TMP/release/server.mjs" "$APP/server.mjs"
install -m 0644 "$TMP/release/package.json" "$APP/package.json"
chown -R "$USER_NAME:$USER_NAME" "$APP"
cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=ORVA CRM standalone application
After=network.target
[Service]
Type=simple
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$APP
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$PORT
ExecStart=$(command -v node) $APP/server.mjs
Restart=always
RestartSec=5
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
echo "[5/5] Verify health"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null; then
    echo "[OK] ORVA CRM healthy at http://127.0.0.1:$PORT"
    systemctl --no-pager --full status "$SERVICE" | head -n 12
    exit 0
  fi
  sleep 2
done
journalctl -u "$SERVICE" -n 60 --no-pager || true
echo "[ERROR] Health check failed" >&2
exit 1
