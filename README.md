# GatePass

GatePass is a full-stack visitor and delivery management system for business centers and office campuses. It combines a Django REST API backend with a React + TypeScript frontend and supports role-based workflows for admins, company operators, employees, and guards.

## Features

- Multi-role access control for `admin`, `company`, `employee`, and `guard`
- Visitor pass workflow with approval, rejection, walk-ins, and QR-code verification
- Entry and exit logging for visitors and deliveries
- Delivery arrival tracking with OTP verification
- SMS and email notifications via Celery tasks
- Analytics dashboards for traffic, entries, and deliveries
- Audit logging for operational traceability

## Tech Stack

### Backend
- Django 5.1
- Django REST Framework 3.15
- PostgreSQL 16
- Celery 5 + Redis 7
- JWT auth via `djangorestframework-simplejwt`

### Frontend
- React 18 + TypeScript 5.6
- Vite 6
- Zustand 5
- TanStack Query v5
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod

---

## Quick Start (Development with Docker)

### Prerequisites

- Docker + Docker Compose v2
- Git

### 1. Clone the repository

```bash
git clone https://github.com/kaleaditya28897-linux/gatepass.git
cd gatepass
```

### 2. Create the development environment file

```bash
cp .env.example .env
```

Set a real `SECRET_KEY` in `.env` before starting the stack.

### 3. Start the development stack

```bash
docker compose up -d --build
```

This starts:

- PostgreSQL on `5432`
- Redis on `6379`
- Django backend on `8000`
- Celery worker
- React frontend on `5173`

### 4. Initialize the database

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py create_admin
docker compose exec backend python manage.py seed_demo_data  # optional
```

### 5. Open the app

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api/v1/`
- Django admin (technical, rarely needed): `http://localhost:8000/django-admin/`

### Demo credentials

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Company Admin | `techcorp_admin` | `password123` |
| Employee | `amit.kumar` | `password123` |
| Guard | `guard.raju` | `password123` |

### Demo walkthrough

Use the seeded accounts to exercise the main workflow end-to-end:

1. Sign in as the employee (`amit.kumar`) and create a visitor pass (**My Passes → New Pass**).
2. Sign in as the company admin (`techcorp_admin`) and approve it (**Passes**). Passes created by a company admin or building admin are approved automatically.
3. Open the pass (eye icon), copy the pass link and open it in a private window: this is what the visitor sees.
4. Sign in as the guard (`guard.raju`), choose a gate, open **Scan Pass**, paste the pass link (or scan the QR with a camera) and check the visitor in. Scan again to check them out.
5. Review the activity as `admin` under **Entries**, **Audit Logs** and the dashboard.

Delivery flow: as the employee add a delivery and note the OTP; as the guard mark it **Arrived**, then **Enter OTP**. Only the correct OTP releases the delivery.

> The demo accounts use published passwords. `seed_demo_data` only runs in development and must never be used on the live system.

---

## Manual Development Setup

### Backend

Requirements:

- Python 3.12+
- PostgreSQL
- Redis

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a local `backend/.env` or export equivalent variables:

```bash
DJANGO_SETTINGS_MODULE=gatepass.settings.development
SECRET_KEY=your-secret-key-here
DB_NAME=gatepass
DB_USER=gatepass
DB_PASSWORD=gatepass
DB_HOST=localhost
DB_PORT=5432
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Run the backend:

```bash
python manage.py migrate
python manage.py create_admin
python manage.py runserver
```

Run Celery in a second terminal:

```bash
celery -A gatepass worker --loglevel=info
```

### Frontend

Requirements:

- Node.js 20+

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```bash
VITE_API_URL=http://localhost:8000/api/v1
```

Start the frontend:

```bash
npm run dev
```

---

## Testing

### Backend

```bash
cd backend
pytest                                               # full suite
pytest apps/passes/tests.py                         # single app
pytest apps/passes/tests.py::TestVisitorPasses      # single class
pytest apps/passes/tests.py::TestVisitorPasses::test_approve_pass
pytest --cov=apps --cov-report=html
```

### Frontend

```bash
cd frontend
npm test
npm test -- --run
npm test -- src/path/to/file.test.tsx --run
```

### End-to-end (real browser against a running stack)

`e2e/` contains a Playwright suite that walks through the whole building workflow as each role
(admin setup → employee invite → company approval → visitor pass page → guard check-in/out,
walk-in and delivery OTP → logs, export and password reset).

```bash
cd e2e
npm install && npx playwright install chromium
E2E_BASE_URL=https://localhost E2E_ADMIN_PASSWORD='your-admin-password' npm test
```

It creates clearly named `E2E …` records, so run it against a test stack rather than the live building.

### Frontend lint + production build

```bash
cd frontend
npm run lint
npm run build
```

---

## Production Deployment

Full guide: [docs/PRODUCTION.md](docs/PRODUCTION.md). In short, on a server with Docker installed:

```bash
git clone https://github.com/kaleaditya28897-linux/gatepass.git /opt/gatepass
cd /opt/gatepass
./deploy.sh
```

`deploy.sh` asks for the address people will use, how HTTPS should work, the time zone and an admin
password. It writes `.env.production` (random secrets), builds and starts the stack, waits for it to
be healthy and creates the admin login. Run it again after `git pull` to upgrade.

### Production architecture

- `frontend`: Caddy serves the built React app, terminates HTTPS (automatic certificates) and proxies `/api/` and `/django-admin/` to Django
- `backend`: Gunicorn serves Django on the internal network only; startup waits for PostgreSQL, runs migrations and `collectstatic`, then drops to an unprivileged user
- `celery`: background worker for notifications, with the embedded scheduler that expires old passes
- `db`: PostgreSQL with persistent storage
- `redis`: Redis (job queue, rate limiting)
- `static_data` and `media_data` volumes are shared between backend and frontend

### Things to know before go-live

- **HTTPS is required** for guards to scan QR codes with a phone camera. Use a real domain if visitors need to open their pass link from outside the building.
- **SMS and email are off until configured.** With `SMS_BACKEND=console` messages are only logged. Add Twilio / SMTP credentials to `.env.production` (see the guide).
- **Back up.** `scripts/backup.sh` dumps the database and media; schedule it and copy the result off the server. `scripts/restore.sh` restores it.
- The Django admin site lives at `/django-admin/` (the path `/admin` belongs to the web app).

### Manual commands

```bash
alias gp='docker compose --env-file .env.production -f docker-compose.prod.yml'
gp ps                       # service health
gp logs -f backend          # or celery / frontend / db
curl -k https://<address>/api/v1/health/
```

---

## API Reference

### Core

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/health/` | GET | Health check for load balancers / container healthchecks |

### Authentication

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/login/` | POST | Login and receive access + refresh JWT tokens |
| `/api/v1/auth/token/refresh/` | POST | Refresh access token |
| `/api/v1/auth/me/` | GET, PATCH | Current user; update own name, email, phone |
| `/api/v1/auth/change-password/` | POST | Change own password |
| `/api/v1/auth/users/` | GET, POST | Admin: list all logins, create admin / company-admin accounts |
| `/api/v1/auth/users/{id}/` | PATCH | Admin: edit or disable an account |
| `/api/v1/auth/users/{id}/set-password/` | POST | Admin: reset a password |

### Companies

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/companies/` | GET, POST | List/create companies (optionally with `admin_account` to create the company admin login) |
| `/api/v1/companies/directory/` | GET | Active companies for pickers (admin, company, guard) |
| `/api/v1/companies/employees/directory/?company=` | GET | Employee names for host pickers |
| `/api/v1/companies/{id}/stats/` | GET | Company statistics |
| `/api/v1/companies/employees/` | GET, POST | List/create employees |
| `/api/v1/companies/employees/bulk-upload/` | POST | CSV bulk upload |

### Gates and guards

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/gates/` | GET, POST | List/create gates |
| `/api/v1/guards/` | GET, POST | List/create guards |
| `/api/v1/shifts/` | GET, POST | Shift management |
| `/api/v1/shifts/my-current/` | GET | Current guard shift (204 when none) |

### Visitor passes

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/passes/` | GET, POST | List/create passes |
| `/api/v1/passes/{id}/approve/` | POST | Approve a pass |
| `/api/v1/passes/{id}/reject/` | POST | Reject a pass (`reason`) |
| `/api/v1/passes/{id}/cancel/` | POST | Cancel a pending or approved pass |
| `/api/v1/passes/verify/{code}/` | GET | Pass lookup by code. Public callers get a limited view; guards/admins get full details |
| `/api/v1/passes/walk-in/` | POST | Guard: create a walk-in pass; with `gate` the visitor is checked in immediately |

### Entries

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/entries/` | GET | Entry log (filters: `entry_type`, `gate`, `date_from`, `date_to`, `active`, `search`) |
| `/api/v1/entries/check-in/` | POST | Guard: check in a visitor (`pass_code`) or delivery (`delivery_id`) at a `gate` |
| `/api/v1/entries/{id}/check-out/` | POST | Guard or admin: check out |
| `/api/v1/entries/active/` | GET | Who is inside right now |
| `/api/v1/entries/export/` | GET | Admin: CSV download of the filtered log |

### Deliveries

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/deliveries/` | GET, POST | List/create deliveries |
| `/api/v1/deliveries/{id}/arrived/` | POST | Guard: mark as arrived (with `gate` it is also written to the entry log) |
| `/api/v1/deliveries/{id}/verify-otp/` | POST | Guard: verify OTP; a correct code marks the delivery delivered |
| `/api/v1/deliveries/{id}/cancel/` | POST | Cancel a delivery that has not arrived |
| `/api/v1/deliveries/{id}/regenerate-otp/` | POST | Recipient side: new OTP, clears a lock |
| `/api/v1/deliveries/pending-gate/` | GET | Deliveries currently pending at the gate |

### Analytics

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/analytics/overview/` | GET | Dashboard summary |
| `/api/v1/analytics/entries-by-date/` | GET | Entry trend over time |
| `/api/v1/analytics/entries-by-gate/` | GET | Entries per gate |
| `/api/v1/analytics/peak-hours/` | GET | Check-ins per hour of day |
| `/api/v1/analytics/delivery-stats/` | GET | Delivery metrics |

---

## Management Commands

```bash
python manage.py create_admin --username admin --password 'a-strong-password' --email admin@example.com
python manage.py seed_demo_data     # development only (publicly known passwords)
python manage.py expire_passes      # also runs automatically every 5 minutes in the worker
python manage.py wait_for_db
python manage.py changepassword <username>
```

---

## Environment Files

- `.env.example` — development Docker/local defaults
- `.env.production.example` — production container stack example (`deploy.sh` creates `.env.production` from it)

### Key production variables

| Variable | Purpose |
|---|---|
| `SITE_ADDRESS` | Host name or IP the web server answers on |
| `TLS_DIRECTIVE` | Empty for an automatic public certificate, `tls internal` for a self-issued one |
| `SECRET_KEY` | Required secure Django secret (min. 32 characters) |
| `DJANGO_SETTINGS_MODULE` | Set to `gatepass.settings.production` |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames |
| `FRONTEND_URL` | Public frontend URL used in QR links |
| `VITE_API_URL` | Build-time frontend API base, typically `/api/v1` |
| `CACHE_URL` | Redis database used for rate limiting |
| `SMS_BACKEND` / `TWILIO_*` / `EMAIL_*` | Notification delivery (`console` only logs messages) |
| `DB_CONN_MAX_AGE` | Persistent DB connection lifetime |
| `DB_SSLMODE` | PostgreSQL SSL mode |
| `SECURE_SSL_REDIRECT` | Force HTTPS redirects |
| `SECURE_HSTS_SECONDS` | HSTS max-age |

---

## Project Structure

```text
gatepass/
├── backend/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── analytics/
│   │   ├── audit/
│   │   ├── companies/
│   │   ├── core/
│   │   ├── deliveries/
│   │   ├── entries/
│   │   ├── gates/
│   │   ├── notifications/
│   │   └── passes/
│   ├── gatepass/settings/
│   ├── tests/                  # API workflow tests
│   ├── entrypoint.sh
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── Caddyfile               # production web server / HTTPS config
│   └── Dockerfile
├── e2e/                        # Playwright browser tests
├── scripts/                    # backup.sh, restore.sh
├── deploy.sh                   # production install / upgrade
├── install.sh                  # development install (no Docker)
├── docker-compose.yml          # development stack
├── docker-compose.prod.yml     # production stack
├── .env.example
└── .env.production.example
```

---

## License

MIT License - see `LICENSE` if present.

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Commit your work
4. Push the branch
5. Open a pull request
