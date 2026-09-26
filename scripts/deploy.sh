#!/usr/bin/env bash
# Copy this repo to the VPS, reinstall production dependencies, and restart the GUI.
# Leaves Apache, TLS, basic-auth users, and existing CSV files in place.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=server.sh
source "$(dirname "$0")/server.sh"

if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
  echo "SSH key not found: $DEPLOY_SSH_KEY" >&2
  exit 1
fi

SSH=(ssh -i "$DEPLOY_SSH_KEY" -o BatchMode=yes "$DEPLOY_HOST")

echo "Deploying $ROOT to $DEPLOY_HOST:$DEPLOY_APP_DIR"

rsync -az --delete \
  --exclude node_modules \
  --exclude output \
  --exclude .git \
  --exclude .cursor \
  -e "ssh -i $(printf '%q' "$DEPLOY_SSH_KEY") -o BatchMode=yes" \
  "$ROOT/" "$DEPLOY_HOST:$DEPLOY_APP_DIR/"

"${SSH[@]}" bash -s -- "$DEPLOY_APP_DIR" "$DEPLOY_SERVICE" << 'EOF'
set -euo pipefail
APP_DIR="$1"
SERVICE="$2"
cd "$APP_DIR"
npm ci --omit=dev
mkdir -p "$APP_DIR/output"
chown -R scrape:scrape "$APP_DIR"
systemctl restart "$SERVICE"
sleep 1
curl -fsS -o /dev/null http://127.0.0.1:3000/
systemctl is-active "$SERVICE"
EOF

echo "Deployed. GUI restarted. Open $DEPLOY_URL"
