#!/usr/bin/env bash
# Runs on the VPS as user "deploy": switches Glosa's environment $1 (dev or
# prod) to the image tag $2, then hands its site block to the shared Caddy.
# The workflow first copies compose.yml and glosa-<env>.caddy into
# /opt/glosa-<env>.
set -euo pipefail

usage() {
  echo "usage: release.sh <dev|prod> <full commit sha>" >&2
  exit 2
}

env="${1:-}"
tag="${2:-}"
case "$env" in
  dev | prod) ;;
  *) usage ;;
esac
[[ "$tag" =~ ^[0-9a-f]{40}$ ]] || usage

block="glosa-$env.caddy"
site="/opt/proxy/sites/$block"

# The folder names the compose project: /opt/glosa-dev runs as "glosa-dev".
cd "/opt/glosa-$env"
printf 'GLOSA_ENV=%s\nGLOSA_TAG=%s\n' "$env" "$tag" > release.env
docker compose --env-file .env --env-file release.env pull
docker compose --env-file .env --env-file release.env up -d --remove-orphans

# Swap in the new site block, keeping the old one until Caddy accepts it, so a
# broken block never stays on disk for the next Caddy restart.
proxy() { docker compose -f /opt/proxy/compose.yml "$@"; }
backup=""
if [ -f "$site" ]; then
  backup="$(mktemp)"
  cp "$site" "$backup"
fi
cp "$block" "$site"
if ! proxy exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "Caddy rejected $block; the previous site block is back." >&2
  if [ -n "$backup" ]; then cp "$backup" "$site"; else rm -f "$site"; fi
  exit 1
fi
proxy exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
if [ -n "$backup" ]; then rm -f "$backup"; fi

# Keep a week of unused images for quick rollbacks; older ones are pulled again.
docker image prune -af --filter "until=168h"
