# GatePass Production Deployment Guide

This is the supported way to run GatePass for a real building: one server running the
Docker stack in `docker-compose.prod.yml`, installed and upgraded with `./deploy.sh`.

## What gets installed

| Service | What it does |
|---|---|
| `frontend` | Caddy web server: serves the web app, terminates HTTPS, proxies `/api/` to the backend |
| `backend` | Django + Gunicorn REST API (runs migrations on start, runs as an unprivileged user) |
| `celery` | Background worker: sends SMS/email, expires old passes every 5 minutes |
| `db` | PostgreSQL 16 (data in the `postgres_data` volume) |
| `redis` | Redis 7 (job queue and login rate limiting) |

Only ports 80 and 443 are published. The database and Redis are not reachable from outside.

## Requirements

- A Linux server (2 CPU / 4 GB RAM / 20 GB disk is plenty for a single building) that stays on
- [Docker Engine with the compose plugin](https://docs.docker.com/engine/install/)
- The server's clock set correctly (passes are time-based)
- **HTTPS.** Browsers only allow camera access (QR scanning) on HTTPS pages. Decide which applies:

| Your situation | Choose | What you need |
|---|---|---|
| Staff and visitors reach GatePass over the internet | `public` | A domain name (e.g. `gatepass.yourbuilding.com`) whose DNS points at the server, ports 80 and 443 open to the internet. A trusted certificate is issued and renewed automatically. |
| Only reachable inside the office network | `internal` | A fixed IP address or internal host name for the server. GatePass makes its own certificate; each device shows a warning until you trust it (see below). Visitors can only open their pass link while on that network. |
| You already run a reverse proxy / load balancer with HTTPS | `http` | The proxy must forward to this server's port 80 and send `X-Forwarded-Proto: https`. |

Visitors receive their pass as a link, so in most buildings the `public` option is the right one.

## Install

```bash
git clone https://github.com/kaleaditya28897-linux/gatepass.git /opt/gatepass
cd /opt/gatepass
./deploy.sh
```

The script asks for the address, the HTTPS option, the time zone and an admin password. It then:

1. writes `.env.production` with a random `SECRET_KEY` and database password (file mode 600)
2. builds and starts the stack
3. waits until the application reports healthy
4. creates the building administrator login

When it finishes, open the address it prints and sign in.

### Trusting the certificate (`internal` option only)

Export GatePass's local certificate authority and install it as a trusted root on each gate
tablet / staff device:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  cp frontend:/data/caddy/pki/authorities/local/root.crt ./gatepass-root.crt
```

Until a device trusts it, the browser shows a certificate warning that has to be accepted once.

## First-time setup in the app

Sign in as the admin, then:

1. **Gates** – add each entrance guards will work at
2. **Companies** – add each tenant; fill in the "Company admin login" section so the tenant can manage their own people
3. **Guards** – add a login for each guard (or one per gate tablet)
4. Optional: **Shifts** – roster guards onto gates so their gate is pre-selected
5. Each company admin signs in and adds employees (**Employees → Add** or **Bulk upload** from CSV)

Hand out the temporary passwords and ask everyone to change theirs under their name → **Account & password**.

## Turning on real SMS and email

Out of the box, messages are only written to the worker log (`SMS_BACKEND=console`). That
includes the pass link sent to visitors and the delivery OTP sent to employees. Employees can
always read their OTP in the app, and hosts can copy the pass link from the pass details, so the
system is usable without SMS, but for day-to-day use you will want it on.

Edit `.env.production`:

```bash
# SMS via Twilio
SMS_BACKEND=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_FROM_NUMBER=+1xxxxxxxxxx

# Email via any SMTP account
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=you@example.com
EMAIL_HOST_PASSWORD=app-password
DEFAULT_FROM_EMAIL=GatePass <you@example.com>
```

Then run `./deploy.sh` again. Phone numbers must be stored in international format (`+91…`)
for Twilio. Check **Notifications** in the admin menu to see whether messages were sent or failed.
For Indian mobile numbers, check Twilio's DLT registration requirements before going live.

## Day-to-day operations

All commands are run from the install directory. To save typing:

```bash
alias gp='docker compose --env-file .env.production -f docker-compose.prod.yml'
```

| Task | Command |
|---|---|
| Status of all services | `gp ps` |
| Follow logs | `gp logs -f backend` (or `celery`, `frontend`, `db`) |
| Restart everything | `gp restart` |
| Stop / start | `gp down` / `gp up -d` (data is kept) |
| Health check | `curl -k https://<address>/api/v1/health/` → `{"status": "ok", "database": "ok"}` |
| Reset a locked-out admin | `gp exec backend python manage.py changepassword admin` |
| Add another admin from the shell | `gp exec -e GATEPASS_ADMIN_PASSWORD='...' backend python manage.py create_admin --username name` |

### Upgrading

```bash
cd /opt/gatepass
scripts/backup.sh          # always back up first
git pull
./deploy.sh                # rebuilds, applies database migrations, restarts
```

### Backups

`scripts/backup.sh` writes a compressed database dump and a copy of the media files
(pass QR codes) to `./backups`, verifies them, and deletes backups older than 14 days.
It is safe to run while the system is in use.

```bash
scripts/backup.sh
# schedule it nightly (root's crontab):
15 2 * * *  /opt/gatepass/scripts/backup.sh >> /var/log/gatepass-backup.log 2>&1
```

**Copy `./backups` and `.env.production` to another machine or cloud storage.** A backup that
lives only on the same disk does not protect you from losing the server.

Restore (replaces current data):

```bash
scripts/restore.sh backups/gatepass-db-YYYYMMDD-HHMMSS.sql.gz backups/gatepass-media-YYYYMMDD-HHMMSS.tar.gz
```

Test a restore once before you rely on it.

## Settings reference (`.env.production`)

| Variable | Purpose |
|---|---|
| `SITE_ADDRESS` | Host name or IP the web server answers on (`http://host` for plain HTTP behind a proxy) |
| `TLS_DIRECTIVE` | Empty = automatic public certificate; `tls internal` = self-issued certificate |
| `HTTP_PORT`, `HTTPS_PORT` | Published ports (default 80 / 443) |
| `FRONTEND_URL` | Full public URL; used in QR codes and pass links. Must match what people actually open. |
| `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | Must contain the same host / origin as `FRONTEND_URL` |
| `SECRET_KEY` | Random secret (min. 32 characters). Changing it signs everyone out. |
| `TIME_ZONE` | Building's time zone, e.g. `Asia/Kolkata` |
| `SECURE_SSL_REDIRECT` | Keep `True` unless GatePass is intentionally HTTP-only |
| `DB_*` | Database name, user, password |
| `CACHE_URL` | Redis database used for rate limiting |
| `SMS_BACKEND`, `TWILIO_*`, `EMAIL_*` | Notification delivery (see above) |
| `PASS_EARLY_CHECKIN_MINUTES` | How early before a pass starts a visitor may check in (default 30) |
| `WALK_IN_VALIDITY_HOURS` | Validity of passes created at the gate (default 8) |
| `DELIVERY_OTP_MAX_ATTEMPTS` | Wrong OTPs before a delivery locks (default 5) |
| `THROTTLE_LOGIN` | Login attempts per username per address (default `10/min`) |
| `GUNICORN_WORKERS` | API worker processes (default: up to 4) |

After changing any value run `./deploy.sh` (or `gp up -d`) to apply it.

## Security notes

- Never run `seed_demo_data` on the live system; it creates accounts with published passwords. It refuses to run in production unless forced.
- The Django admin site is at `/django-admin/` and only accepts the superuser created by `deploy.sh`. Day-to-day administration is done in the web app; you rarely need it.
- Login is rate limited, passwords must pass Django's strength checks, and every sign-in, approval, check-in, check-out and OTP attempt is recorded in **Audit Logs**.
- Disable accounts (Users page) rather than deleting them when someone leaves, so the audit trail keeps their name.
- Keep the server patched (`apt upgrade`), restrict SSH to keys, and allow only ports 22, 80 and 443 in the firewall.
- Visitor data (names, phone numbers, ID details) is personal data. Decide how long you keep entry logs and who may export them.

## Troubleshooting

| Symptom | Check |
|---|---|
| `deploy.sh` says the backend did not become healthy | `gp logs backend`. Usually a wrong value in `.env.production` (`ALLOWED_HOSTS`, `SECRET_KEY` too short, database password changed after first start). |
| Browser shows a certificate error on a public domain | DNS must point at this server and ports 80/443 must be reachable from the internet. `gp logs frontend` shows the certificate attempts. |
| "Camera access was blocked" on the scan page | The page must be HTTPS, and the browser must be allowed to use the camera for the site. Typing/pasting the pass code always works. |
| QR codes point to the wrong address | Fix `FRONTEND_URL`, run `./deploy.sh`. Existing QR codes keep the old address; cancel and re-issue those passes. |
| Nobody receives SMS | **Notifications** page shows the error per message. `gp logs celery` for details. |
| Guard cannot check anyone in | They must choose a gate, and at least one gate must be marked open on the **Gates** page. |
| Times look wrong | Set `TIME_ZONE` and check the server clock (`timedatectl`). |

More in [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
