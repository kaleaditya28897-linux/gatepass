#!/usr/bin/env bash
#
# Restore a GatePass backup made by scripts/backup.sh.
#
#   scripts/restore.sh backups/gatepass-db-20261121-021500.sql.gz [backups/gatepass-media-20261121-021500.tar.gz]
#
# This REPLACES the current database contents (and media, if given).
set -euo pipefail

db_file=${1:-}
media_file=${2:-}
[ -n "$db_file" ] && [ -f "$db_file" ] || { echo "Usage: $0 <gatepass-db-*.sql.gz> [gatepass-media-*.tar.gz]" >&2; exit 1; }
db_file=$(readlink -f "$db_file")
[ -z "$media_file" ] || media_file=$(readlink -f "$media_file")

cd "$(dirname "$(readlink -f "$0")")/.."
ENV_FILE=.env.production
if [ -n "${COMPOSE_CMD:-}" ]; then read -r -a COMPOSE <<<"$COMPOSE_CMD"
elif docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose)
else COMPOSE=(docker-compose); fi
compose() { "${COMPOSE[@]}" --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"; }

if [ "${RESTORE_CONFIRM:-}" != "yes" ]; then
  read -r -p "This replaces ALL current GatePass data with $(basename "$db_file"). Type 'yes' to continue: " answer
  [ "$answer" = "yes" ] || { echo "Cancelled."; exit 1; }
fi

gzip -t "$db_file"
echo "Stopping the application while restoring..."
compose stop backend celery
gzip -dc "$db_file" | compose exec -T db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null
compose start backend celery

if [ -n "$media_file" ]; then
  gzip -t "$media_file"
  for _ in $(seq 1 30); do compose exec -T backend true 2>/dev/null && break; sleep 2; done
  compose exec -T backend tar -xzf - -C /app <"$media_file"
fi
echo "Restore complete."
