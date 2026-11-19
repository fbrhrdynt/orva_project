#!/usr/bin/env bash
set -Eeuo pipefail

REPO="git@github.com:fbrhrdynt/orva_project.git"
BRANCH="main"
APP="/opt/orva-platform"
BACKUPS="/home/ubuntu/codex/backups/orva-platform"
SERVICE="orva-platform"
PORT="3103"
DOMAIN="orva.febro.id"
USER_NAME="ubuntu"
KEY="/home/ubuntu/.ssh/orva_deploy_key"
NGINX_DIR="/etc/nginx/conf.d"
NGINX_FILE="$NGINX_DIR/orva-platform.conf"
UNIT_FILE="/etc/systemd/system/$SERVICE.service"
LEGACY_NGINX_FILE="$NGINX_DIR/orva.conf"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUPS/deploy-$STAMP"
TMP="$(mktemp -d /tmp/orva-platform.XXXXXX)"
COMMITTED=0

cleanup() {
  rm -rf "$TMP"
}
rollback() {
  local status=$?
  trap - ERR
  if [[ "$COMMITTED" -eq 0 ]]; then
    echo "[ROLLBACK] Restoring previous ORVA release and Nginx configuration..." >&2
    systemctl stop "$SERVICE" >/dev/null 2>&1 || true
    if [[ -f "$BACKUP_DIR/release.tar.gz" ]]; then
      rm -rf "$APP/public"
      rm -f "$APP/server.mjs" "$APP/package.json"
      tar -xzf "$BACKUP_DIR/release.tar.gz" -C "$APP" || true
    fi
    if [[ -f "$BACKUP_DIR/service.unit" ]]; then
      cp -a "$BACKUP_DIR/service.unit" "$UNIT_FILE"
    elif [[ -f "$BACKUP_DIR/service.unit.absent" ]]; then
      rm -f "$UNIT_FILE"
    fi
    if [[ -f "$BACKUP_DIR/orva-platform.conf" ]]; then
      cp -a "$BACKUP_DIR/orva-platform.conf" "$NGINX_FILE"
    elif [[ -f "$BACKUP_DIR/orva-platform.conf.absent" ]]; then
      rm -f "$NGINX_FILE"
    fi
    if [[ -f "$BACKUP_DIR/orva.conf" ]]; then
      cp -a "$BACKUP_DIR/orva.conf" "$LEGACY_NGINX_FILE"
    elif [[ -f "$BACKUP_DIR/orva.conf.absent" ]]; then
      rm -f "$LEGACY_NGINX_FILE"
    fi
    systemctl daemon-reload || true
    if nginx -t; then systemctl reload nginx || true; fi
    systemctl restart "$SERVICE" >/dev/null 2>&1 || true
    echo "[ROLLBACK] Backup: $BACKUP_DIR" >&2
  fi
  cleanup
  exit "$status"
}
trap rollback ERR
trap cleanup EXIT

for command in git node systemctl curl tar nginx ss; do
  command -v "$command" >/dev/null 2>&1 || { echo "[ERROR] Missing command: $command" >&2; exit 1; }
done
id "$USER_NAME" >/dev/null 2>&1 || { echo "[ERROR] User $USER_NAME not found" >&2; exit 1; }
[[ -r "$KEY" ]] || { echo "[ERROR] Deploy key unavailable: $KEY" >&2; exit 1; }
[[ -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]] || { echo "[ERROR] TLS certificate missing for $DOMAIN" >&2; exit 1; }
[[ -s "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]] || { echo "[ERROR] TLS private key missing for $DOMAIN" >&2; exit 1; }

install -d -o "$USER_NAME" -g "$USER_NAME" "$BACKUPS" "$APP" "$BACKUP_DIR"

echo "[1/8] Checking port ownership"
CURRENT_PID="$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || echo 0)"
PORT_PIDS="$(ss -H -lntp "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
if [[ -n "$PORT_PIDS" ]]; then
  while IFS= read -r pid; do
    [[ -z "$pid" || "$pid" == "$CURRENT_PID" ]] || {
      echo "[ERROR] Port $PORT is owned by unrelated PID $pid; refusing to stop it." >&2
      ps -fp "$pid" >&2 || true
      exit 1
    }
  done <<< "$PORT_PIDS"
fi

echo "[2/8] Fetching and validating repository source"
GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/repo"
SRC="$TMP/repo/apps/platform"
[[ -s "$SRC/app.html" && -s "$SRC/server.mjs" && -s "$SRC/package.json" ]] || {
  echo "[ERROR] Required files missing in apps/platform." >&2
  exit 1
}
node --check "$SRC/server.mjs"
grep -q '<title>ORVA — Workspace</title>' "$SRC/app.html" || {
  echo "[ERROR] app.html does not match expected ORVA Workspace source." >&2
  exit 1
}
mkdir -p "$TMP/release/public"
install -m 0644 "$SRC/app.html" "$TMP/release/public/index.html"
install -m 0644 "$SRC/server.mjs" "$TMP/release/server.mjs"
install -m 0644 "$SRC/package.json" "$TMP/release/package.json"

echo "[3/8] Backing up current release and Nginx files"
if [[ -f "$APP/server.mjs" || -f "$APP/package.json" || -d "$APP/public" ]]; then
  items=()
  for item in public server.mjs package.json; do
    [[ ! -e "$APP/$item" ]] || items+=("$item")
  done
  if (("${#items[@]}")); then tar -czf "$BACKUP_DIR/release.tar.gz" -C "$APP" "${items[@]}"; fi
fi
[[ ! -f "$UNIT_FILE" ]] || cp -a "$UNIT_FILE" "$BACKUP_DIR/service.unit"
[[ -f "$UNIT_FILE" ]] || touch "$BACKUP_DIR/service.unit.absent"
[[ ! -f "$NGINX_FILE" ]] || cp -a "$NGINX_FILE" "$BACKUP_DIR/orva-platform.conf"
[[ -f "$NGINX_FILE" ]] || touch "$BACKUP_DIR/orva-platform.conf.absent"
[[ ! -f "$LEGACY_NGINX_FILE" ]] || cp -a "$LEGACY_NGINX_FILE" "$BACKUP_DIR/orva.conf"
[[ -f "$LEGACY_NGINX_FILE" ]] || touch "$BACKUP_DIR/orva.conf.absent"

echo "[4/8] Installing exact repository HTML"
systemctl stop "$SERVICE" >/dev/null 2>&1 || true
install -d "$APP"
rm -rf "$APP/public.new"
cp -a "$TMP/release/public" "$APP/public.new"
rm -rf "$APP/public"
mv "$APP/public.new" "$APP/public"
install -m 0644 "$TMP/release/server.mjs" "$APP/server.mjs"
install -m 0644 "$TMP/release/package.json" "$APP/package.json"
chown -R "$USER_NAME:$USER_NAME" "$APP"

echo "[5/8] Installing systemd service on port $PORT"
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
ExecStart=/usr/bin/node $APP/server.mjs
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
systemctl enable "$SERVICE" >/dev/null
systemctl start "$SERVICE"

echo "[6/8] Verifying ORVA process identity and upstream"
READY=0
for attempt in $(seq 1 20); do
  MAIN_PID="$(systemctl show -p MainPID --value "$SERVICE")"
  if systemctl is-active --quiet "$SERVICE" && [[ "$MAIN_PID" =~ ^[1-9][0-9]*$ ]] \
    && tr '\0' ' ' < "/proc/$MAIN_PID/cmdline" 2>/dev/null | grep -Fq "$APP/server.mjs" \
    && ss -H -lntp "sport = :$PORT" | grep -Fq "pid=$MAIN_PID" \
    && curl -fsS --max-time 2 "http://127.0.0.1:$PORT/" -o "$TMP/platform.html" \
    && grep -q '<title>ORVA — Workspace</title>' "$TMP/platform.html"; then
    READY=1
    break
  fi
  sleep 2
done
[[ "$READY" -eq 1 ]] || {
  journalctl -u "$SERVICE" -n 60 --no-pager >&2 || true
  echo "[ERROR] ORVA Platform failed process-identity health check." >&2
  exit 1
}

echo "[7/8] Installing one authoritative Nginx virtual host"
cat > "$TMP/orva-nginx.conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $DOMAIN;

    client_max_body_size 25m;
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location = /crm {
        return 301 /crm/;
    }

    location /crm/ {
        proxy_pass http://127.0.0.1:3200/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
NGINX
install -m 0644 "$TMP/orva-nginx.conf" "$NGINX_FILE"
if [[ -f "$LEGACY_NGINX_FILE" ]]; then
  mv "$LEGACY_NGINX_FILE" "$BACKUP_DIR/orva.conf.disabled"
fi
nginx -t
NGINX_DUMP="$(nginx -T 2>&1)"
SERVER_COUNT="$(printf '%s\n' "$NGINX_DUMP" | grep -Ec 'server_name[[:space:]]+orva\.febro\.id;' || true)"
[[ "$SERVER_COUNT" -eq 2 ]] || {
  echo "[ERROR] Expected exactly two ORVA server_name declarations (HTTP + HTTPS), found $SERVER_COUNT." >&2
  exit 1
}
systemctl reload nginx

echo "[8/8] End-to-end checks"
curl -fsS --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" -o "$TMP/domain-platform.html"
grep -q '<title>ORVA — Workspace</title>' "$TMP/domain-platform.html"
curl -fsS --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/crm/" -o "$TMP/domain-crm.html"
grep -qi 'ORVA CRM' "$TMP/domain-crm.html"
systemctl is-active --quiet "$SERVICE"
systemctl is-active --quiet nginx
if systemctl is-active --quiet orva-crm; then
  curl -fsS --max-time 5 "http://127.0.0.1:3200/" >/dev/null
fi
sleep 4
systemctl is-active --quiet "$SERVICE"

COMMITTED=1
echo
echo "=================================================="
echo "[SUCCESS] ORVA Platform deployed from GitHub main"
echo "Dashboard : https://$DOMAIN/"
echo "CRM       : https://$DOMAIN/crm/"
echo "Port      : $PORT"
echo "Backup    : $BACKUP_DIR"
echo "Source    : apps/platform/app.html"
echo "=================================================="
systemctl --no-pager --full status "$SERVICE" | head -n 14
