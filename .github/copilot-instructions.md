# GatePass – Copilot Instructions

GatePass is a visitor/delivery management system with a Django REST API backend and a React + TypeScript frontend. It supports four user roles (admin, company, employee, guard) and uses JWT authentication, Celery async tasks, and QR-code-based pass verification.

---

## Commands

### Backend (run from `backend/`)
```bash
pytest                                          # full test suite
pytest apps/passes/tests.py                    # single app
pytest apps/passes/tests.py::TestClass::test_method  # single test
pytest --cov=apps --cov-report=html            # with coverage

python manage.py runserver                     # dev server on :8000
python manage.py migrate
python manage.py create_admin                  # create superuser
python manage.py seed_demo_data                # load demo fixtures
python manage.py expire_passes                 # expire old passes (cron)

celery -A gatepass worker --loglevel=info      # async worker
```

### Frontend (run from `frontend/`)
```bash
npm run dev          # dev server on :5173
npm run build        # type-check + production build
npm run lint         # ESLint
npm test             # Vitest (watch mode)
npm test -- --run    # run once
npm test -- src/path/to/file.test.tsx --run  # single file
```

### Docker
```bash
docker-compose up -d
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py seed_demo_data
```

---

## Architecture

### Backend – Django apps under `backend/apps/`
| App | Responsibility |
|-----|----------------|
| `accounts` | Custom User model, JWT login, role-based permissions |
| `companies` | Company + Employee management |
| `gates` | Gate, Guard, GuardShift management |
| `passes` | Visitor pass lifecycle (create → approve → check-in/out) |
| `entries` | Immutable check-in/check-out log |
| `deliveries` | Delivery tracking with OTP verification |
| `notifications` | Celery tasks for SMS (Twilio) and email |
| `analytics` | Dashboard metrics |
| `audit` | JSON-based audit trail |
| `core` | `TimestampedModel` base, pagination utilities |

All API endpoints follow `/api/v1/<resource>/` using DRF `DefaultRouter` + `ModelViewSet`.

Settings are split: `gatepass/settings/base.py`, `development.py`, `production.py`, `test.py`. Tests use `DJANGO_SETTINGS_MODULE=gatepass.settings.test` (SQLite in-memory, fast password hasher, eager Celery tasks).

### Frontend – `frontend/src/`
- **`api/`** – Axios-based modules per resource (`passes.ts`, `companies.ts`, etc.). All share `client.ts` which adds the JWT `Authorization` header and auto-refreshes on 401.
- **`store/`** – Zustand: `authStore.ts` (token + user, persisted to localStorage), `uiStore.ts`.
- **`pages/`** – Route pages grouped by role: `admin/`, `company/`, `employee/`, `guard/`.
- **`components/auth/ProtectedRoute`** – guards routes by `isAuthenticated` and `user.role`.
- **`types/`** – Shared TypeScript interfaces (User, Company, VisitorPass, etc.).
- TanStack Query v5 is used for all server-state fetching/caching.

---

## Key Conventions

### Backend
- **Every model** inherits `TimestampedModel` (provides `created_at`, `updated_at`) and defaults `ordering = ["-created_at"]`.
- **Choices** are defined as nested `TextChoices` classes on the model (e.g., `VisitorPass.Status.PENDING`).
- **Serializers** use `read_only=True` for `id` and `created_at`; computed/nested fields use `source=` on the model field.
- **Permissions** live in `apps/accounts/permissions.py`: `IsAdmin`, `IsCompanyAdmin`, `IsEmployee`, `IsGuard`, and composites. Use these (not `IsAuthenticated` alone) in ViewSets.
- **Custom management commands** go in `apps/<app>/management/commands/`.
- Celery notification tasks in `apps/notifications/tasks.py` are triggered from viewset `perform_create/update` methods.
- `db_table` is explicitly set on every model Meta (lowercase snake_case).

### Frontend
- New API calls belong in the corresponding `src/api/<resource>.ts` module and follow the existing object pattern:
  ```ts
  export const passes = {
    list: () => apiClient.get<VisitorPass[]>('/passes/'),
    create: (data: CreatePassPayload) => apiClient.post<VisitorPass>('/passes/', data),
  }
  ```
- Pages use TanStack Query hooks (`useQuery`, `useMutation`) directly — no manual `useEffect` + `useState` for fetching.
- Role-gated UI is handled by reading `user.role` from `useAuthStore()`, not from a separate context.
- New shadcn/ui components are added via `npx shadcn@latest add <component>` — do not hand-write Radix primitives.
- Forms use React Hook Form + Zod: define a Zod schema, infer the type, pass to `useForm<Schema>({ resolver: zodResolver(schema) })`.

### Environment
- Backend reads env via `python-decouple`; add new variables to `.env.example` with safe defaults.
- Frontend env vars must be prefixed `VITE_` and accessed as `import.meta.env.VITE_*`.
- `VITE_API_URL` (default `http://localhost:8000/api/v1`) is the only required frontend env var for local dev.

## MCP Servers

Configured in `.vscode/mcp.json`:

- **Playwright** – browser automation for the React frontend (E2E flows, QR scan UI, role-based navigation).
- **PostgreSQL** – direct DB access using the local/Docker credentials (`postgresql://gatepass:gatepass@localhost:5432/gatepass`). Useful for inspecting pass/entry state during development.

---

### User Roles
```
admin    → full system access
company  → manage own company's employees, passes, deliveries
employee → create pass requests, view own deliveries
guard    → QR scan check-in/out, view active visitors and deliveries at gate
```
