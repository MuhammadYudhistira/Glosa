#!/usr/bin/env bash
# Runs on the VPS as user "deploy" (spec 1E §5): switches Glosa to the image
# tag given as $1, then hands Glosa's site block to the shared Caddy.
# The workflow copies compose.yml and glosa.caddy into /opt/glosa first.
set -euo pipefail

tag="${1:?usage: release.sh <image tag>}"
site=/opt/proxy/sites/glosa.caddy

cd /opt/glosa
printf 'GLOSA_TAG=%s\n' "$tag" > release.env
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
cp glosa.caddy "$site"
if ! proxy exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "Caddy rejected glosa.caddy; the previous site block is back." >&2
  if [ -n "$backup" ]; then cp "$backup" "$site"; else rm -f "$site"; fi
  exit 1
fi
proxy exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
if [ -n "$backup" ]; then rm -f "$backup"; fi

# Keep a week of unused images for quick rollbacks; older ones are pulled again.
docker image prune -af --filter "until=168h"
