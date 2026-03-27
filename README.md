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
- Django admin: `http://localhost:8000/admin/`

### Demo credentials

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Company Admin | `techcorp_admin` | `password123` |
| Employee | `amit.kumar` | `password123` |
| Guard | `guard.raju` | `password123` |

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

### Frontend lint + production build

```bash
cd frontend
npm run lint
npm run build
```

---

## Production Deployment

The repository now includes a production-ready container stack in `docker-compose.prod.yml`.

### Production architecture

- `frontend`: Nginx serves the built React app on port `80`
- `frontend`: Nginx also proxies `/api/` and `/admin/` to the Django backend
- `backend`: Gunicorn serves Django internally on port `8000`
- `backend`: startup waits for PostgreSQL, then runs migrations and `collectstatic`
- `celery`: background worker for notifications/tasks
- `db`: PostgreSQL with persistent storage
- `redis`: Redis with persistent append-only storage
- `static_data` and `media_data` are shared volumes between backend and frontend

### 1. Create the production environment file

```bash
cp .env.production.example .env.production
```

Update at least these values before starting:

- `SECRET_KEY`
- `DB_PASSWORD`
- `ALLOWED_HOSTS`
- `FRONTEND_URL`
- `CSRF_TRUSTED_ORIGINS`
- `CORS_ALLOWED_ORIGINS`
- SMTP/Twilio settings if you want real notifications

### 2. Start the production stack

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### 3. Verify it

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl http://localhost/api/v1/health/
```

### 4. View logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f celery
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f frontend
```

### Production notes

- The production stack serves the app on port `80`
- The frontend build uses `VITE_API_URL=/api/v1` so browser traffic stays same-origin
- `SECRET_KEY` and `ALLOWED_HOSTS` are required in production settings
- Database connectivity in production supports `DB_CONN_MAX_AGE` and `DB_SSLMODE`
- The backend health endpoint is available at `GET /api/v1/health/`

### Manual deployment alternative

If you do not want to use containers, the backend can still run with Gunicorn and the frontend can be built as static assets behind Nginx. The production settings module is:

```bash
DJANGO_SETTINGS_MODULE=gatepass.settings.production
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
| `/api/v1/auth/me/` | GET | Current authenticated user |

### Companies

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/companies/` | GET, POST | List/create companies |
| `/api/v1/companies/{id}/stats/` | GET | Company statistics |
| `/api/v1/companies/employees/` | GET, POST | List/create employees |
| `/api/v1/companies/employees/bulk-upload/` | POST | CSV bulk upload |

### Gates and guards

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/gates/` | GET, POST | List/create gates |
| `/api/v1/guards/` | GET, POST | List/create guards |
| `/api/v1/shifts/` | GET, POST | Shift management |
| `/api/v1/shifts/my-current/` | GET | Current guard shift |

### Visitor passes

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/passes/` | GET, POST | List/create passes |
| `/api/v1/passes/{id}/approve/` | POST | Approve a pass |
| `/api/v1/passes/{id}/reject/` | POST | Reject a pass |
| `/api/v1/passes/verify/{code}/` | GET | Public QR-code verification endpoint |
| `/api/v1/passes/walk-in/` | POST | Create a walk-in pass |

### Entries

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/entries/check-in/` | POST | Check in a visitor or delivery |
| `/api/v1/entries/{id}/check-out/` | POST | Check out a visitor |
| `/api/v1/entries/active/` | GET | List active visitors |

### Deliveries

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/deliveries/` | GET, POST | List/create deliveries |
| `/api/v1/deliveries/{id}/arrived/` | POST | Mark a delivery as arrived |
| `/api/v1/deliveries/{id}/verify-otp/` | POST | Verify OTP and release delivery |
| `/api/v1/deliveries/pending-gate/` | GET | Deliveries currently pending at the gate |

### Analytics

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/analytics/overview/` | GET | Dashboard summary |
| `/api/v1/analytics/entries-by-date/` | GET | Entry trend over time |
| `/api/v1/analytics/peak-hours/` | GET | Peak traffic hours |
| `/api/v1/analytics/delivery-stats/` | GET | Delivery metrics |

---

## Management Commands

```bash
python manage.py create_admin --username admin --password securepass --email admin@example.com
python manage.py seed_demo_data
python manage.py expire_passes
python manage.py wait_for_db
```

---

## Environment Files

- `.env.example` — development Docker/local defaults
- `.env.production.example` — production container stack example

### Key production variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Required secure Django secret |
| `DJANGO_SETTINGS_MODULE` | Set to `gatepass.settings.production` |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames |
| `FRONTEND_URL` | Public frontend URL used in QR links |
| `VITE_API_URL` | Build-time frontend API base, typically `/api/v1` |
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
│   ├── entrypoint.sh
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
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
