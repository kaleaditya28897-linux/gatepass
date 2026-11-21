#!/usr/bin/env bash
#
# GatePass production deployment.
#
#   ./deploy.sh            first install (asks a few questions) or upgrade (re-uses .env.production)
#
# Requires Docker with the compose plugin. Everything is kept in Docker volumes;
# see scripts/backup.sh for backups.
#
# Unattended use: set GATEPASS_SITE_ADDRESS, GATEPASS_TLS_MODE (public|internal|http),
# GATEPASS_ADMIN_PASSWORD (and optionally GATEPASS_ADMIN_USER, GATEPASS_TIME_ZONE,
# GATEPASS_HTTP_PORT, GATEPASS_HTTPS_PORT, COMPOSE_CMD).
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"
ENV_FILE=.env.production
COMPOSE_FILE=docker-compose.prod.yml

say()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARNING:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

if [ -n "${COMPOSE_CMD:-}" ]; then
  read -r -a COMPOSE <<<"$COMPOSE_CMD"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  die "Docker with the compose plugin is required. Install it from https://docs.docker.com/engine/install/ and run this script again."
fi
compose() { "${COMPOSE[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

random_secret() { head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

set_env() { # set_env KEY VALUE  (replaces the line in $ENV_FILE)
  local key=$1 value=$2 tmp
  tmp=$(mktemp)
  awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; found=1; next} {print} END{if(!found) print k "=" v}' "$ENV_FILE" >"$tmp"
  cat "$tmp" >"$ENV_FILE" && rm -f "$tmp"
}

ask() { # ask VAR "Prompt" "default"
  local var=$1 prompt=$2 default=${3:-} answer
  if [ -n "${!var:-}" ]; then return; fi
  [ -t 0 ] || die "$var is not set and there is no terminal to ask on."
  read -r -p "$prompt${default:+ [$default]}: " answer
  printf -v "$var" '%s' "${answer:-$default}"
}

# --------------------------------------------------------------------------- configuration
if [ -f "$ENV_FILE" ]; then
  say "Using existing $ENV_FILE (delete it to be asked the setup questions again)"
else
  say "First-time setup"
  echo "GatePass must be served over HTTPS so that guards' phones can use the camera to scan passes."
  ask GATEPASS_SITE_ADDRESS "Address people will type to open GatePass (domain name or this server's IP)" ""
  [ -n "$GATEPASS_SITE_ADDRESS" ] || die "An address is required."
  case "$GATEPASS_SITE_ADDRESS" in *://*|*/*|*" "*) die "Enter only the host name or IP address, e.g. gatepass.mybuilding.com";; esac

  if [ -z "${GATEPASS_TLS_MODE:-}" ]; then
    cat <<'MENU'

How should HTTPS work?
  1) public   - a real domain name pointing at this server, reachable from the internet
                on ports 80 and 443. A trusted certificate is obtained automatically.
  2) internal - office network or IP address only. GatePass creates its own certificate;
                browsers show a warning until you trust it on each device (see docs/PRODUCTION.md).
  3) http     - no HTTPS here because another reverse proxy in front already provides it.
MENU
    ask TLS_CHOICE "Choose 1, 2 or 3" "1"
    case "$TLS_CHOICE" in 1|public) GATEPASS_TLS_MODE=public;; 2|internal) GATEPASS_TLS_MODE=internal;; 3|http) GATEPASS_TLS_MODE=http;; *) die "Unknown choice.";; esac
  fi
  ask GATEPASS_TIME_ZONE "Time zone of the building" "Asia/Kolkata"

  HTTP_PORT=${GATEPASS_HTTP_PORT:-80}
  HTTPS_PORT=${GATEPASS_HTTPS_PORT:-443}
  port_suffix=""
  case "$GATEPASS_TLS_MODE" in
    public)   scheme=https; site=$GATEPASS_SITE_ADDRESS; tls="";;
    internal) scheme=https; site=$GATEPASS_SITE_ADDRESS; tls="tls internal"
              [ "$HTTPS_PORT" = 443 ] || port_suffix=":$HTTPS_PORT";;
    http)     scheme=https; site="http://$GATEPASS_SITE_ADDRESS"; tls=""
              warn "HTTP mode: make sure the proxy in front forwards X-Forwarded-Proto and serves https://$GATEPASS_SITE_ADDRESS";;
    *) die "GATEPASS_TLS_MODE must be public, internal or http.";;
  esac
  origin="$scheme://$GATEPASS_SITE_ADDRESS$port_suffix"

  cp .env.production.example "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  set_env SITE_ADDRESS "$site"
  set_env TLS_DIRECTIVE "$tls"
  set_env HTTP_PORT "$HTTP_PORT"
  set_env HTTPS_PORT "$HTTPS_PORT"
  set_env FRONTEND_URL "$origin"
  set_env ALLOWED_HOSTS "$GATEPASS_SITE_ADDRESS"
  set_env CORS_ALLOWED_ORIGINS "$origin"
  set_env CSRF_TRUSTED_ORIGINS "$origin"
  set_env TIME_ZONE "$GATEPASS_TIME_ZONE"
  set_env SECRET_KEY "$(random_secret 64)"
  set_env DB_PASSWORD "$(random_secret 32)"
  set_env DEFAULT_FROM_EMAIL "noreply@$GATEPASS_SITE_ADDRESS"
  if [ "$GATEPASS_TLS_MODE" = internal ] && [[ "$GATEPASS_SITE_ADDRESS" =~ ^[0-9.]+$ ]]; then
    # Clients connecting by IP send no server name; tell Caddy which certificate to use.
    set_env CADDY_GLOBAL_OPTIONS "default_sni $GATEPASS_SITE_ADDRESS"
  fi
  echo "Wrote $ENV_FILE (contains secrets: keep it private and include it in your backups)."
fi

# --------------------------------------------------------------------------- build and start
say "Building images (the first run takes a few minutes)"
compose build

say "Starting GatePass"
compose up -d

say "Waiting for the application to become healthy"
healthy=0
for _ in $(seq 1 60); do
  if compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/', timeout=3)" >/dev/null 2>&1; then
    healthy=1; break
  fi
  sleep 3
done
[ "$healthy" = 1 ] || { compose ps || true; die "The backend did not become healthy. Check: ${COMPOSE[*]} --env-file $ENV_FILE -f $COMPOSE_FILE logs backend"; }
compose exec -T backend python manage.py check --deploy --fail-level ERROR >/dev/null || die "Django deployment check failed."

# --------------------------------------------------------------------------- first admin
has_admin=$(compose exec -T backend python manage.py shell -c "from apps.accounts.models import User; print(int(User.objects.filter(role='admin', is_active=True).exists()))" 2>/dev/null | tr -dc '01' | tail -c 1)
if [ "$has_admin" != "1" ]; then
  say "Create the building administrator login"
  ask GATEPASS_ADMIN_USER "Admin username" "admin"
  if [ -z "${GATEPASS_ADMIN_PASSWORD:-}" ]; then
    [ -t 0 ] || die "GATEPASS_ADMIN_PASSWORD is not set and there is no terminal to ask on."
    while :; do
      read -r -s -p "Admin password (at least 8 characters, not a common word): " GATEPASS_ADMIN_PASSWORD; echo
      read -r -s -p "Repeat the password: " again; echo
      [ "$GATEPASS_ADMIN_PASSWORD" = "$again" ] || { echo "The passwords do not match."; continue; }
      if compose exec -T -e GATEPASS_ADMIN_PASSWORD="$GATEPASS_ADMIN_PASSWORD" backend python manage.py create_admin --username "$GATEPASS_ADMIN_USER"; then
        break
      fi
    done
  else
    compose exec -T -e GATEPASS_ADMIN_PASSWORD="$GATEPASS_ADMIN_PASSWORD" backend python manage.py create_admin --username "$GATEPASS_ADMIN_USER"
  fi
fi

url=$(grep '^FRONTEND_URL=' "$ENV_FILE" | cut -d= -f2-)
say "GatePass is running at $url"
cat <<NEXT
Next steps:
  1. Sign in as the admin and add gates, companies and guards.
  2. To send real SMS and email, fill in the TWILIO_* / EMAIL_* values in $ENV_FILE and run ./deploy.sh again.
     Until then messages (including delivery OTPs) are only written to the worker log.
  3. Schedule backups:  scripts/backup.sh  (see docs/PRODUCTION.md).
NEXT
