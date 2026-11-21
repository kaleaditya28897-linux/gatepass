#!/bin/sh
set -eu

APP_USER=gatepass

# Started as root (the default): make sure the shared volumes are writable by the
# unprivileged app user, even if they were created by an older image, then drop
# privileges and start again as that user.
if [ "$(id -u)" = "0" ]; then
  # Pre-create the upload folders so the media volume is never empty (some
  # container runtimes re-own an empty volume each time another service mounts it).
  mkdir -p /app/staticfiles /app/media/qr_codes /app/media/visitor_photos \
    /app/media/avatars /app/media/company_logos
  for dir in /app/staticfiles /app/media; do
    if [ -n "$(find "$dir" ! -user "$APP_USER" -print -quit)" ]; then
      chown -R "$APP_USER:$APP_USER" "$dir"
    fi
  done
  exec setpriv --reuid="$APP_USER" --regid="$APP_USER" --init-groups "$0" "$@"
fi

python manage.py wait_for_db

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  python manage.py migrate --noinput
fi

if [ "${COLLECT_STATIC:-0}" = "1" ]; then
  python manage.py collectstatic --noinput
fi

exec "$@"
