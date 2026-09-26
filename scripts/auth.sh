#!/usr/bin/env bash
# Add or update an Apache basic-auth user on the VPS. Prompts for the password.
set -euo pipefail

# shellcheck source=server.sh
source "$(dirname "$0")/server.sh"

usage() {
  cat << EOF
Usage:
  ./scripts/auth.sh add USERNAME      Create a new basic-auth user
  ./scripts/auth.sh passwd USERNAME   Change an existing user's password

The password is typed on this Mac and is not stored in the repo.
EOF
}

if [[ $# -ne 2 ]]; then
  usage >&2
  exit 1
fi

action="$1"
user="$2"

if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
  echo "SSH key not found: $DEPLOY_SSH_KEY" >&2
  exit 1
fi

if [[ ! "$user" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
  echo "Username must be 1-64 characters: letters, numbers, dot, underscore, or hyphen." >&2
  exit 1
fi

case "$action" in
  add)
    remote_check="if grep -q '^${user}:' '${DEPLOY_HTPASSWD}'; then echo 'User already exists. Run: ./scripts/auth.sh passwd ${user}'; exit 1; fi"
    ;;
  passwd)
    remote_check="if ! grep -q '^${user}:' '${DEPLOY_HTPASSWD}'; then echo 'User not found. Run: ./scripts/auth.sh add ${user}'; exit 1; fi"
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

ssh -t -i "$DEPLOY_SSH_KEY" -o BatchMode=yes "$DEPLOY_HOST" \
  "set -euo pipefail
   ${remote_check}
   htpasswd '${DEPLOY_HTPASSWD}' '${user}'
   systemctl reload apache2
   echo 'Saved. Apache reloaded.'"
