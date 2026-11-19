#!/usr/bin/env bash
set -Eeuo pipefail
trap 'status=$?; echo "[ERROR] Platform deployment failed at line ${LINENO} (exit ${status})" >&2; exit "$status"' ERR

REPO="git@github.com:fbrhrdynt/orva_project.git"
BRANCH="main"
APP="/opt/orva-platform"
BACKUPS="/home/ubuntu/codex/backups/orva-platform"
SERVICE="orva-platform"
PORT="3100"
DOMAIN="orva.febro.id"
USER_NAME="ubuntu"
KEY="/home/ubuntu/.ssh/orva_deploy_key"
NGINX_DIR="/etc/nginx/conf.d"
NGINX_FILE="$NGINX_DIR/orva-platform.conf"
TMP="$(mktemp -d /tmp/orva-platform.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

for c in git node systemctl curl tar; do command -v "$c" >/dev/null 2>&1 || { echo "[ERROR] Missing command: $c" >&2; exit 1; }; done
id "$USER_NAME" >/dev/null 2>&1 || { echo "[ERROR] User $USER_NAME not found" >&2; exit 1; }
test -r "$KEY" || { echo "[ERROR] Deploy key unavailable: $KEY" >&2; exit 1; }
install -d -o "$USER_NAME" -g "$USER_NAME" "$BACKUPS" "$APP"

echo "[1/6] Fetch platform source"
GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/repo"
SRC="$TMP/repo/apps/platform"
test -s "$SRC/app.html" && test -s "$SRC/server.mjs" && test -s "$SRC/package.json" || { echo "[ERROR] Source apps/platform incomplete" >&2; exit 1; }

echo "[2/6] Validate and stage"
node --check "$SRC/server.mjs"
node -e "const p=require('$SRC/package.json');if(p.type!=='module')process.exit(1)"
mkdir -p "$TMP/release/public"
install -m 0644 "$SRC/app.html" "$TMP/release/public/index.html"
install -m 0644 "$SRC/server.mjs" "$TMP/release/server.mjs"
install -m 0644 "$SRC/package.json" "$TMP/release/package.json"

echo "[3/6] Backup existing release"
if [[ -d "$APP/public" || -f "$APP/server.mjs" || -f "$APP/package.json" ]]; then
 BACKUP="$BACKUPS/orva-platform-$(date +%Y%m%d-%H%M%S).tar.gz"
 items=(); for item in public server.mjs package.json; do [[ ! -e "$APP/$item" ]] || items+=("$item"); done
 tar -czf "$BACKUP" -C "$APP" "${items[@]}"
 echo "[OK] Backup: $BACKUP"
fi

echo "[4/6] Install systemd service"
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
Description=ORVA Platform Workspace
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

echo "[5/6] Configure Nginx routes"
if command -v nginx >/dev/null 2>&1 && [[ -d "$NGINX_DIR" ]]; then
 NGINX_BACKUP=""
 if [[ -f "$NGINX_FILE" ]]; then NGINX_BACKUP="$BACKUPS/orva-platform-nginx-$(date +%Y%m%d-%H%M%S).conf"; cp -a "$NGINX_FILE" "$NGINX_BACKUP"; fi
 CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
 CERTKEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
 cat > "$TMP/nginx.conf" <<NGINX
server {
 listen 80;
 server_name $DOMAIN;
 location = /crm { return 301 /crm/; }
 location /crm/ {
  proxy_pass http://127.0.0.1:3200/;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
 }
 location / {
  proxy_pass http://127.0.0.1:$PORT;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
 }
}
NGINX
 if [[ -s "$CERT" && -s "$CERTKEY" ]]; then
 cat >> "$TMP/nginx.conf" <<NGINX
server {
 listen 443 ssl;
 server_name $DOMAIN;
 ssl_certificate $CERT;
 ssl_certificate_key $CERTKEY;
 location = /crm { return 301 /crm/; }
 location /crm/ {
  proxy_pass http://127.0.0.1:3200/;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
 }
 location / {
  proxy_pass http://127.0.0.1:$PORT;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
 }
}
NGINX
 fi
 install -m 0644 "$TMP/nginx.conf" "$NGINX_FILE"
 if nginx -t; then systemctl reload nginx; echo "[OK] Nginx configured for $DOMAIN"; else
  if [[ -n "$NGINX_BACKUP" ]]; then cp -a "$NGINX_BACKUP" "$NGINX_FILE"; else rm -f "$NGINX_FILE"; fi
  echo "[ERROR] Nginx validation failed; previous config restored" >&2; exit 1
 fi
else echo "[WARN] Nginx not detected; app remains on localhost:$PORT"; fi

echo "[6/6] Health checks"
ok=0
for attempt in $(seq 1 20); do
 if systemctl is-active --quiet "$SERVICE" && curl --fail --silent "http://127.0.0.1:$PORT/" >/dev/null; then ok=1; break; fi
 sleep 2
done
if [[ "$ok" -ne 1 ]]; then journalctl -u "$SERVICE" -n 80 --no-pager >&2 || true; systemctl status "$SERVICE" --no-pager --full >&2 || true; echo "[ERROR] Platform health check failed" >&2; exit 1; fi
if systemctl is-active --quiet orva-crm; then curl --fail --silent "http://127.0.0.1:3200/" >/dev/null || { echo "[ERROR] CRM upstream unhealthy" >&2; exit 1; }; fi
echo "[SUCCESS] ORVA Platform healthy"
echo "Domain  : https://$DOMAIN"
echo "CRM     : https://$DOMAIN/crm/"
echo "Service : $SERVICE"
echo "Port    : $PORT"
echo "Install : $APP"
echo "Backup  : $BACKUPS"
systemctl --no-pager --full status "$SERVICE" | head -n 12
