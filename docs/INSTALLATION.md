# GatePass Installation Guide

This guide will help you install GatePass on your Linux system. Choose your preferred method below.

---

## Table of Contents

1. [Quick Install (Recommended)](#quick-install-recommended)
2. [Manual Installation](#manual-installation)
   - [Ubuntu/Debian](#ubuntudebian)
   - [Fedora](#fedora)
   - [Arch Linux](#arch-linux)
3. [Docker Installation](#docker-installation)
4. [Troubleshooting](#troubleshooting)

---

## Quick Install (Recommended)

The easiest way to install GatePass is using our automated installer:

```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/kaleaditya28897-linux/gatepass/main/install.sh | bash
```

Or if you've already cloned the repository:

```bash
cd gatepass
chmod +x install.sh
./install.sh
```

The installer will:
- ✅ Detect your Linux distribution
- ✅ Install all required dependencies
- ✅ Set up PostgreSQL and Redis
- ✅ Configure the backend and frontend
- ✅ Create convenient start/stop scripts

---

## Manual Installation

### Prerequisites

Before you begin, ensure you have:
- A Linux system (Ubuntu 20.04+, Debian 11+, Fedora 35+, or Arch Linux)
- At least 2GB RAM
- At least 5GB free disk space
- Internet connection
- sudo/root access

---

### Ubuntu/Debian

#### Step 1: Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### Step 2: Install Dependencies
```bash
# Install Python and build tools
sudo apt install -y python3 python3-pip python3-venv python3-dev build-essential

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib libpq-dev

# Install Redis
sudo apt install -y redis-server

# Install Node.js (v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git and other utilities
sudo apt install -y git curl wget
```

#### Step 3: Start Services
```bash
# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Start and enable Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### Step 4: Create Database
```bash
# Switch to postgres user and create database
sudo -u postgres psql << EOF
CREATE USER gatepass WITH PASSWORD 'your_secure_password';
CREATE DATABASE gatepass OWNER gatepass;
GRANT ALL PRIVILEGES ON DATABASE gatepass TO gatepass;
\q
EOF
```

Continue to [Application Setup](#application-setup).

---

### Fedora

#### Step 1: Update System
```bash
sudo dnf update -y
```

#### Step 2: Install Dependencies
```bash
# Install Python and build tools
sudo dnf install -y python3 python3-pip python3-virtualenv python3-devel gcc

# Install PostgreSQL
sudo dnf install -y postgresql postgresql-server postgresql-contrib postgresql-devel

# Initialize PostgreSQL
sudo postgresql-setup --initdb

# Install Redis
sudo dnf install -y redis

# Install Node.js
sudo dnf install -y nodejs npm

# Install Git and utilities
sudo dnf install -y git curl wget
```

#### Step 3: Configure PostgreSQL Authentication

Edit the PostgreSQL authentication file:
```bash
sudo nano /var/lib/pgsql/data/pg_hba.conf
```

Find the line that looks like:
```
local   all             all                                     peer
```

Change `peer` to `md5`:
```
local   all             all                                     md5
```

#### Step 4: Start Services
```bash
# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Start and enable Redis
sudo systemctl start redis
sudo systemctl enable redis
```

#### Step 5: Create Database
```bash
sudo -u postgres psql << EOF
CREATE USER gatepass WITH PASSWORD 'your_secure_password';
CREATE DATABASE gatepass OWNER gatepass;
GRANT ALL PRIVILEGES ON DATABASE gatepass TO gatepass;
\q
EOF
```

Continue to [Application Setup](#application-setup).

---

### Arch Linux

#### Step 1: Update System
```bash
sudo pacman -Syu
```

#### Step 2: Install Dependencies
```bash
# Install Python
sudo pacman -S --noconfirm python python-pip python-virtualenv

# Install PostgreSQL
sudo pacman -S --noconfirm postgresql

# Install Redis
sudo pacman -S --noconfirm redis

# Install Node.js
sudo pacman -S --noconfirm nodejs npm

# Install Git and utilities
sudo pacman -S --noconfirm git curl wget base-devel
```

#### Step 3: Initialize PostgreSQL
```bash
# Switch to postgres user and initialize
sudo -iu postgres initdb -D /var/lib/postgres/data
```

#### Step 4: Start Services
```bash
# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Start and enable Redis
sudo systemctl start redis
sudo systemctl enable redis
```

#### Step 5: Create Database
```bash
sudo -u postgres psql << EOF
CREATE USER gatepass WITH PASSWORD 'your_secure_password';
CREATE DATABASE gatepass OWNER gatepass;
GRANT ALL PRIVILEGES ON DATABASE gatepass TO gatepass;
\q
EOF
```

Continue to [Application Setup](#application-setup).

---

## Application Setup

These steps are the same for all distributions.

### Step 1: Clone Repository
```bash
git clone https://github.com/kaleaditya28897-linux/gatepass.git
cd gatepass
```

### Step 2: Backend Setup
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create environment file
cp ../.env.example .env

# Edit .env with your database password
nano .env
```

Update these values in `.env`:
```
DB_PASSWORD=your_secure_password
SECRET_KEY=your_random_secret_key
```

Generate a secret key:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Step 3: Initialize Database
```bash
# Run migrations
python manage.py migrate

# Create admin user
python manage.py create_admin

# (Optional) Load demo data
python manage.py seed_demo_data
```

### Step 4: Frontend Setup
```bash
cd ../frontend

# Install Node.js dependencies
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local
```

### Step 5: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

**Terminal 2 - Celery Worker:**
```bash
cd backend
source venv/bin/activate
celery -A gatepass worker --loglevel=info
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

### Step 6: Access GatePass

Open your browser and go to:
- **Frontend:** http://localhost:5173
- **Admin Panel:** http://localhost:8000/admin/

Login with:
- **Username:** admin
- **Password:** admin123

---

## Docker Installation

If you prefer Docker, this is the simplest method:

### Prerequisites
- Docker installed ([Install Docker](https://docs.docker.com/engine/install/))
- Docker Compose installed ([Install Docker Compose](https://docs.docker.com/compose/install/))

### Steps

```bash
# Clone repository
git clone https://github.com/kaleaditya28897-linux/gatepass.git
cd gatepass

# Create environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Wait for services to start (about 30 seconds)
sleep 30

# Run migrations and create admin
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py create_admin
docker-compose exec backend python manage.py seed_demo_data
```

Access GatePass at http://localhost:5173

---

## Troubleshooting

### PostgreSQL Connection Refused

**Problem:** `psycopg2.OperationalError: could not connect to server`

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql

# Check if it's listening on the right port
sudo netstat -tlnp | grep 5432
```

### Redis Connection Error

**Problem:** `redis.exceptions.ConnectionError`

**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# Should return "PONG"
# If not, start Redis:
sudo systemctl start redis-server  # Ubuntu/Debian
sudo systemctl start redis         # Fedora/Arch
```

### Permission Denied on Port 80

**Problem:** Can't bind to port 80

**Solution:** Use a port above 1024 (like 8000) or run with sudo (not recommended)

### Node.js Version Too Old

**Problem:** `SyntaxError` or npm errors

**Solution:**
```bash
# Check Node.js version
node --version

# Should be v18 or higher
# Install newer version using NodeSource or nvm
```

### Python Module Not Found

**Problem:** `ModuleNotFoundError`

**Solution:**
```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

---

## Next Steps

After installation:

1. **Change Default Passwords** - See [SECURITY.md](SECURITY.md)
2. **Configure for Production** - See [PRODUCTION.md](PRODUCTION.md)
3. **Set Up Backups** - See [BACKUP.md](BACKUP.md)
4. **Learn the Features** - See [USER_GUIDE.md](USER_GUIDE.md)

---

## Getting Help

- 📖 Read the [FAQ](FAQ.md)
- 🐛 Report issues on [GitHub](https://github.com/kaleaditya28897-linux/gatepass/issues)
- 📧 Contact support at support@gatepass.local
