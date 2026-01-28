# GatePass - Business Center Access Control System

A comprehensive full-stack application for managing visitor access, deliveries, and security operations in business centers and corporate buildings.

## Features

- **Multi-Role Access Control**: Admin, Company Admin, Employee, and Guard roles with distinct permissions
- **Visitor Pass Management**: Pre-approved passes, walk-in registration, QR code generation
- **Entry/Exit Logging**: Real-time tracking of visitor check-ins and check-outs
- **Delivery Tracking**: Food orders, couriers, documents with OTP verification
- **Notifications**: SMS and email alerts for pass approvals, visitor arrivals
- **Analytics Dashboard**: Entry statistics, peak hours, delivery metrics
- **Audit Logging**: Complete activity trail for compliance and security

## Tech Stack

### Backend
- **Framework**: Django 5.1 + Django REST Framework
- **Database**: PostgreSQL 16
- **Task Queue**: Celery + Redis
- **Authentication**: JWT (djangorestframework-simplejwt)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand (auth) + TanStack Query (server state)
- **Charts**: Recharts

---

## Quick Start (Docker)

### Prerequisites
- Docker & Docker Compose installed
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/kaleaditya28897-linux/gatepass.git
cd gatepass
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` file with your settings (defaults work for local development).

### 3. Start Services
```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Django backend (port 8000)
- Celery worker
- React frontend (port 5173)

### 4. Initialize Database
```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Create admin user
docker-compose exec backend python manage.py create_admin

# (Optional) Load demo data
docker-compose exec backend python manage.py seed_demo_data
```

### 5. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/api/v1/
- **Django Admin**: http://localhost:8000/admin/

### Demo Credentials
| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Company Admin | techcorp_admin | password123 |
| Employee | amit.kumar | password123 |
| Guard | guard.raju | password123 |

---

## Manual Setup (Development)

### Backend Setup

#### Prerequisites
- Python 3.12+
- PostgreSQL 14+
- Redis 7+

#### 1. Create Virtual Environment
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 3. Configure Database
Create a PostgreSQL database:
```sql
CREATE DATABASE gatepass;
CREATE USER gatepass WITH PASSWORD 'gatepass';
GRANT ALL PRIVILEGES ON DATABASE gatepass TO gatepass;
```

#### 4. Environment Variables
```bash
export DJANGO_SETTINGS_MODULE=gatepass.settings.development
export DB_NAME=gatepass
export DB_USER=gatepass
export DB_PASSWORD=gatepass
export DB_HOST=localhost
export DB_PORT=5432
export CELERY_BROKER_URL=redis://localhost:6379/0
```

#### 5. Run Migrations
```bash
python manage.py migrate
python manage.py create_admin
```

#### 6. Start Development Server
```bash
python manage.py runserver
```

#### 7. Start Celery Worker (separate terminal)
```bash
celery -A gatepass worker --loglevel=info
```

### Frontend Setup

#### Prerequisites
- Node.js 20+
- npm or yarn

#### 1. Install Dependencies
```bash
cd frontend
npm install
```

#### 2. Configure API URL
Create `.env.local`:
```
VITE_API_URL=http://localhost:8000/api/v1
```

#### 3. Start Development Server
```bash
npm run dev
```

---

## Production Deployment

### Backend (Gunicorn + Nginx)

#### 1. Update Settings
```bash
export DJANGO_SETTINGS_MODULE=gatepass.settings.production
export SECRET_KEY=your-secure-secret-key
export ALLOWED_HOSTS=yourdomain.com
export CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

#### 2. Collect Static Files
```bash
python manage.py collectstatic --noinput
```

#### 3. Run with Gunicorn
```bash
gunicorn gatepass.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

#### 4. Nginx Configuration
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location /static/ {
        alias /path/to/backend/staticfiles/;
    }

    location /media/ {
        alias /path/to/backend/media/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Frontend (Static Build)

#### 1. Build for Production
```bash
cd frontend
npm run build
```

#### 2. Serve with Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api.yourdomain.com;
    }
}
```

### Celery (Systemd Service)

Create `/etc/systemd/system/gatepass-celery.service`:
```ini
[Unit]
Description=GatePass Celery Worker
After=network.target

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/path/to/backend
ExecStart=/path/to/venv/bin/celery -A gatepass worker --loglevel=info --detach
ExecStop=/bin/kill -s TERM $MAINPID
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable gatepass-celery
sudo systemctl start gatepass-celery
```

---

## API Documentation

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/login/` | POST | Login with username/password |
| `/api/v1/auth/token/refresh/` | POST | Refresh JWT token |
| `/api/v1/auth/me/` | GET | Get current user info |

### Companies
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/companies/` | GET, POST | List/Create companies |
| `/api/v1/companies/{id}/` | GET, PUT, DELETE | Company details |
| `/api/v1/companies/{id}/stats/` | GET | Company statistics |
| `/api/v1/companies/employees/` | GET, POST | List/Create employees |
| `/api/v1/companies/employees/bulk-upload/` | POST | CSV bulk upload |

### Gates & Guards
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/gates/` | GET, POST | List/Create gates |
| `/api/v1/guards/` | GET, POST | List/Create guards |
| `/api/v1/shifts/` | GET, POST | List/Create shifts |
| `/api/v1/shifts/my-current/` | GET | Current guard's shift |

### Visitor Passes
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/passes/` | GET, POST | List/Create passes |
| `/api/v1/passes/{id}/approve/` | POST | Approve pass |
| `/api/v1/passes/{id}/reject/` | POST | Reject pass |
| `/api/v1/passes/verify/{code}/` | GET | Verify pass (public) |
| `/api/v1/passes/walk-in/` | POST | Create walk-in pass |

### Entry Logs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/entries/` | GET | List entries |
| `/api/v1/entries/check-in/` | POST | Check in visitor |
| `/api/v1/entries/{id}/check-out/` | POST | Check out visitor |
| `/api/v1/entries/active/` | GET | Active visitors |

### Deliveries
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/deliveries/` | GET, POST | List/Create deliveries |
| `/api/v1/deliveries/{id}/arrived/` | POST | Mark as arrived |
| `/api/v1/deliveries/{id}/delivered/` | POST | Mark as delivered |
| `/api/v1/deliveries/{id}/verify-otp/` | POST | Verify delivery OTP |
| `/api/v1/deliveries/pending-gate/` | GET | Pending at gate |

### Analytics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/analytics/overview/` | GET | Dashboard stats |
| `/api/v1/analytics/entries-by-date/` | GET | Entries over time |
| `/api/v1/analytics/entries-by-gate/` | GET | Entries per gate |
| `/api/v1/analytics/peak-hours/` | GET | Peak traffic hours |
| `/api/v1/analytics/delivery-stats/` | GET | Delivery metrics |

---

## Management Commands

```bash
# Create admin user
python manage.py create_admin --username admin --password securepass

# Seed demo data
python manage.py seed_demo_data

# Expire old passes (run via cron)
python manage.py expire_passes
```

### Cron Job for Expiring Passes
```cron
0 * * * * cd /path/to/backend && /path/to/venv/bin/python manage.py expire_passes
```

---

## Testing

### Backend Tests
```bash
cd backend
pytest --cov=apps --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm test
```

---

## Project Structure

```
gatepass/
├── backend/
│   ├── apps/
│   │   ├── accounts/      # User model, JWT auth
│   │   ├── companies/     # Company & Employee
│   │   ├── gates/         # Gate, Guard, Shift
│   │   ├── passes/        # Visitor passes, QR
│   │   ├── entries/       # Check-in/out logs
│   │   ├── deliveries/    # Delivery tracking
│   │   ├── notifications/ # SMS/Email tasks
│   │   ├── analytics/     # Dashboard queries
│   │   └── audit/         # Activity logs
│   ├── gatepass/          # Django settings
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/           # API clients
│       ├── components/    # React components
│       ├── pages/         # Route pages
│       ├── hooks/         # Custom hooks
│       ├── store/         # Zustand stores
│       └── types/         # TypeScript types
├── docker-compose.yml
└── .env.example
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | (required in prod) |
| `DB_NAME` | PostgreSQL database name | gatepass |
| `DB_USER` | PostgreSQL username | gatepass |
| `DB_PASSWORD` | PostgreSQL password | gatepass |
| `DB_HOST` | PostgreSQL host | localhost |
| `CELERY_BROKER_URL` | Redis URL for Celery | redis://localhost:6379/0 |
| `FRONTEND_URL` | Frontend URL for QR links | http://localhost:5173 |
| `SMS_BACKEND` | SMS provider (console/twilio) | console |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | - |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | - |
| `TWILIO_FROM_NUMBER` | Twilio sender number | - |

---

## License

MIT License - see LICENSE file for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
