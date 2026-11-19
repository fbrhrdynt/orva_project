#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "[ERROR] Deploy gagal pada baris $LINENO. Periksa pesan di atas." >&2' ERR
APP_DIR="/opt/orva"
REPO="git@github-orva:fbrhrdynt/orva_project.git"
BRANCH="main"
KEY="/root/.ssh/orva_github_deploy"
SSH_CONFIG="/root/.ssh/config"
SERVICE="orva.service"
PORT="3200"

need_root(){ [[ "$EUID" -eq 0 ]] || { echo "Jalankan: sudo bash $0"; exit 1; }; }
need_root
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git openssh-client ca-certificates curl
install -d -m 700 /root/.ssh
if [[ ! -f "$KEY" ]]; then
  ssh-keygen -t ed25519 -C "orva-vps-deploy" -f "$KEY" -N "" >/dev/null
  chmod 600 "$KEY"; chmod 644 "$KEY.pub"
  echo
  echo "============================================================"
  echo "DEPLOY KEY BARU DIBUAT. TAMBAHKAN KEY INI KE GITHUB DULU:"
  echo "Repository: https://github.com/fbrhrdynt/orva_project/settings/keys"
  echo "Pilih Add deploy key, beri nama ORVA VPS, centang Allow read access."
  cat "$KEY.pub"
  echo "============================================================"
  echo "Setelah key ditambahkan, jalankan ulang script yang sama."
  exit 0
fi
if ! grep -q 'Host github-orva' "$SSH_CONFIG" 2>/dev/null; then
  cat >> "$SSH_CONFIG" <<EOF
Host github-orva
  HostName github.com
  User git
  IdentityFile $KEY
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
  chmod 600 "$SSH_CONFIG"
fi
ssh-keyscan -H github.com >> /root/.ssh/known_hosts 2>/dev/null || true
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" && -x /home/ubuntu/.nvm/versions/node/v22.23.5/bin/node ]]; then NODE_BIN=/home/ubuntu/.nvm/versions/node/v22.23.5/bin/node; fi
if [[ -z "$NODE_BIN" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  NODE_BIN="$(command -v node)"
fi
node_major="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
[[ "$node_major" -ge 20 ]] || { echo "Node.js >=20 dibutuhkan, ditemukan $($NODE_BIN --version)" >&2; exit 1; }

if [[ ! -d "$APP_DIR/.git" ]]; then
  install -d -o root -g root -m 755 "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
else
  git -C "$APP_DIR" remote set-url origin "$REPO"
  git -C "$APP_DIR" fetch --prune origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi
id orva >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin orva
chown -R orva:orva "$APP_DIR"
chmod -R u=rwX,g=rX,o= "$APP_DIR"
cat > /etc/systemd/system/$SERVICE <<EOF
[Unit]
Description=ORVA Enterprise Platform
After=network.target

[Service]
Type=simple
User=orva
Group=orva
WorkingDirectory=$APP_DIR/apps/web
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$PORT
ExecStart=$NODE_BIN $APP_DIR/apps/web/server.mjs
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now "$SERVICE"
sleep 2
systemctl --no-pager --full status "$SERVICE"
curl --fail --silent --show-error "http://127.0.0.1:$PORT/" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$PORT/dashboard" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$PORT/crm" >/dev/null
echo
echo "DEPLOY OK — ORVA berada dalam satu folder: $APP_DIR"
echo "App Launcher : http://SERVER-IP:$PORT/"
echo "Dashboard   : http://SERVER-IP:$PORT/dashboard"
echo "CRM         : http://SERVER-IP:$PORT/crm"
echo "Service     : systemctl status orva"
