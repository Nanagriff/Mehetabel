#!/usr/bin/env bash
# Sync dist/ and the compose files to the Contabo box and (re)start the container.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${HOST:-mauplus}
DEST=/opt/mehetabel
ssh "$HOST" "mkdir -p $DEST"
rsync -az --delete dist/ "$HOST:$DEST/dist/"
rsync -az deploy/docker-compose.yml deploy/nginx.container.conf "$HOST:$DEST/"
ssh "$HOST" "cd $DEST && docker compose up -d --remove-orphans"
