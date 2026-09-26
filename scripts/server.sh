# Shared SSH target for the Hetzner deploy scripts.
# Override any value in the environment when calling a script.

DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_hetzner}"
DEPLOY_HOST="${DEPLOY_HOST:-root@178.104.0.32}"
DEPLOY_APP_DIR="${DEPLOY_APP_DIR:-/opt/scrape-a-list}"
DEPLOY_SERVICE="${DEPLOY_SERVICE:-scrape-a-list}"
DEPLOY_HTPASSWD="${DEPLOY_HTPASSWD:-/etc/apache2/scrape-a-list.htpasswd}"
DEPLOY_URL="${DEPLOY_URL:-https://scrape-a-list.lucamack.at}"
