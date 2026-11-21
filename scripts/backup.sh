#!/usr/bin/env bash
#
# Back up the GatePass database and uploaded media into ./backups (or $BACKUP_DIR).
# Safe to run while the system is in use. Schedule it daily, e.g. in root's crontab:
#
#   15 2 * * *  /opt/gatepass/scripts/backup.sh >> /var/log/gatepass-backup.log 2>&1
#
# and copy the backups directory to another machine. Keeps KEEP_DAYS days (default 14).
set -euo pipefail
umask 077  # backups contain personal data

cd "$(dirname "$(readlink -f "$0")")/.."
ENV_FILE=.env.production
[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE found. Is GatePass installed here?" >&2; exit 1; }

if [ -n "${COMPOSE_CMD:-}" ]; then read -r -a COMPOSE <<<"$COMPOSE_CMD"
elif docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose)
else COMPOSE=(docker-compose); fi
compose() { "${COMPOSE[@]}" --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"; }

BACKUP_DIR=${BACKUP_DIR:-backups}
KEEP_DAYS=${KEEP_DAYS:-14}
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

db_file="$BACKUP_DIR/gatepass-db-$stamp.sql.gz"
media_file="$BACKUP_DIR/gatepass-media-$stamp.tar.gz"

# Write to a temporary name first so a failed run never leaves a truncated "backup".
compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' | gzip >"$db_file.partial"
gzip -t "$db_file.partial"
[ "$(gzip -dc "$db_file.partial" | tail -n 5 | grep -c 'PostgreSQL database dump complete')" = 1 ] \
  || { echo "Database dump is incomplete." >&2; rm -f "$db_file.partial"; exit 1; }
mv "$db_file.partial" "$db_file"

compose exec -T backend tar -czf - -C /app media >"$media_file.partial"
gzip -t "$media_file.partial"
mv "$media_file.partial" "$media_file"

find "$BACKUP_DIR" -name 'gatepass-*.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') backup complete: $db_file ($(du -h "$db_file" | cut -f1)), $media_file ($(du -h "$media_file" | cut -f1))"
