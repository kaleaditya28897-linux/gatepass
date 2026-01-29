# GatePass Production Deployment Guide

This guide covers deploying GatePass to a production environment with proper security, performance, and reliability configurations.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Security Checklist](#security-checklist)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Nginx Configuration](#nginx-configuration)
7. [SSL/HTTPS Setup](#sslhttps-setup)
8. [Process Management](#process-management)
9. [Database Configuration](#database-configuration)
10. [Monitoring & Logging](#monitoring--logging)
11. [Backup Strategy](#backup-strategy)
12. [Scaling](#scaling)

---

## Prerequisites

Before deploying to production, ensure you have:

- [ ] A Linux server (Ubuntu 22.04 LTS recommended)
- [ ] A domain name pointing to your server
- [ ] SSH access to your server
- [ ] Basic Linux command line knowledge

---

## Server Requirements

### Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| Bandwidth | 1 TB/month | Unlimited |

### Recommended Providers

- **DigitalOcean** - Simple, affordable ($24/month for recommended)
- **Linode** - Good performance
- **AWS EC2** - Scalable, more complex
- **Vultr** - Good value

---

## Security Checklist

Before going live, complete this checklist:

### Server Security

- [ ] Update all system packages
- [ ] Configure firewall (UFW)
- [ ] Disable root SSH login
- [ ] Use SSH key authentication only
- [ ] Install fail2ban
- [ ] Enable automatic security updates

### Application Security

- [ ] Change all default passwords
- [ ] Set strong SECRET_KEY
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Set secure cookie flags
- [ ] Review file permissions

### Database Security

- [ ] Use strong database password
- [ ] Restrict database access to localhost
- [ ] Enable PostgreSQL SSL (optional)
- [ ] Set up automated backups

---

## Backend Deployment

### Step 1: System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3 python3-pip python3-venv \
    postgresql postgresql-contrib \
    redis-server \
    nginx \
    supervisor \
    certbot python3-certbot-nginx

# Create application user
sudo useradd -m -s /bin/bash gatepass
sudo usermod -aG sudo gatepass
```

### Step 2: Clone Application

```bash
# Switch to gatepass user
sudo -u gatepass -i

# Clone repository
git clone https://github.com/kaleaditya28897-linux/gatepass.git ~/gatepass
cd ~/gatepass/backend
```

### Step 3: Python Environment

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn  # Production server
```

### Step 4: Production Configuration

Create `/home/gatepass/gatepass/backend/.env`:

```bash
# Django Settings
SECRET_KEY=your-super-secure-random-key-here
DJANGO_SETTINGS_MODULE=gatepass.settings.production
DEBUG=False

# Database
DB_NAME=gatepass
DB_USER=gatepass
DB_PASSWORD=your-secure-database-password
DB_HOST=localhost
DB_PORT=5432

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# URLs
FRONTEND_URL=https://yourdomain.com
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Security
SECURE_SSL_REDIRECT=True
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SECURE=True

# Email (configure your SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@yourdomain.com

# SMS (optional - Twilio)
SMS_BACKEND=twilio
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_FROM_NUMBER=+1234567890
```

Generate a secure SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Step 5: Database Setup

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE USER gatepass WITH PASSWORD 'your-secure-database-password';
CREATE DATABASE gatepass OWNER gatepass;
GRANT ALL PRIVILEGES ON DATABASE gatepass TO gatepass;
EOF

# Run migrations
cd ~/gatepass/backend
source venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py create_admin --password your-secure-admin-password
```

### Step 6: Test Gunicorn

```bash
gunicorn gatepass.wsgi:application --bind 0.0.0.0:8000
# Test: curl http://localhost:8000/api/v1/auth/me/
# Should return 401 (unauthorized) - this is correct
# Press Ctrl+C to stop
```

---

## Frontend Deployment

### Step 1: Install Node.js

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 2: Build Frontend

```bash
cd ~/gatepass/frontend

# Install dependencies
npm ci --production=false

# Create production environment file
cat > .env.production << EOF
VITE_API_URL=https://yourdomain.com/api/v1
EOF

# Build for production
npm run build
```

This creates a `dist/` folder with static files.

### Step 3: Serve Static Files

The built frontend will be served by Nginx (configured below).

---

## Nginx Configuration

Create `/etc/nginx/sites-available/gatepass`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (React static files)
    location / {
        root /home/gatepass/gatepass/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files (Django)
    location /static/ {
        alias /home/gatepass/gatepass/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files (uploads)
    location /media/ {
        alias /home/gatepass/gatepass/backend/media/;
        expires 1d;
    }

    # Logging
    access_log /var/log/nginx/gatepass_access.log;
    error_log /var/log/nginx/gatepass_error.log;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/gatepass /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL/HTTPS Setup

### Using Let's Encrypt (Free)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot automatically:
- Obtains SSL certificates
- Updates Nginx configuration
- Sets up auto-renewal (cron job)

---

## Process Management

### Using Supervisor

Create `/etc/supervisor/conf.d/gatepass.conf`:

```ini
[program:gatepass-backend]
command=/home/gatepass/gatepass/backend/venv/bin/gunicorn gatepass.wsgi:application --bind 127.0.0.1:8000 --workers 4 --timeout 120
directory=/home/gatepass/gatepass/backend
user=gatepass
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/gatepass/backend.log
environment=DJANGO_SETTINGS_MODULE="gatepass.settings.production"

[program:gatepass-celery]
command=/home/gatepass/gatepass/backend/venv/bin/celery -A gatepass worker --loglevel=info
directory=/home/gatepass/gatepass/backend
user=gatepass
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/gatepass/celery.log

[group:gatepass]
programs=gatepass-backend,gatepass-celery
```

Apply configuration:
```bash
# Create log directory
sudo mkdir -p /var/log/gatepass
sudo chown gatepass:gatepass /var/log/gatepass

# Reload supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start gatepass:*
```

### Management Commands

```bash
# Check status
sudo supervisorctl status gatepass:*

# Restart services
sudo supervisorctl restart gatepass:*

# View logs
sudo tail -f /var/log/gatepass/backend.log
sudo tail -f /var/log/gatepass/celery.log
```

---

## Database Configuration

### PostgreSQL Tuning

Edit `/etc/postgresql/14/main/postgresql.conf`:

```ini
# Memory (adjust based on your server RAM)
shared_buffers = 1GB           # 25% of RAM
effective_cache_size = 3GB     # 75% of RAM
work_mem = 64MB
maintenance_work_mem = 256MB

# Connections
max_connections = 100

# Write-ahead log
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Automated Backups

Create `/home/gatepass/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR=/home/gatepass/backups
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="gatepass_backup_$DATE.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U gatepass gatepass | gzip > $BACKUP_DIR/$FILENAME

# Keep only last 7 days
find $BACKUP_DIR -name "gatepass_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $FILENAME"
```

Add to crontab:
```bash
chmod +x /home/gatepass/backup.sh
crontab -e
# Add: 0 2 * * * /home/gatepass/backup.sh
```

---

## Monitoring & Logging

### Application Logs

- Backend: `/var/log/gatepass/backend.log`
- Celery: `/var/log/gatepass/celery.log`
- Nginx: `/var/log/nginx/gatepass_*.log`

### Log Rotation

Create `/etc/logrotate.d/gatepass`:

```
/var/log/gatepass/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 gatepass gatepass
    postrotate
        supervisorctl restart gatepass:* > /dev/null
    endscript
}
```

### Health Checks

Create `/home/gatepass/healthcheck.sh`:

```bash
#!/bin/bash

# Check backend
if curl -s http://localhost:8000/api/v1/ > /dev/null; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: FAILED"
fi

# Check PostgreSQL
if pg_isready -U gatepass > /dev/null; then
    echo "✅ PostgreSQL: OK"
else
    echo "❌ PostgreSQL: FAILED"
fi

# Check Redis
if redis-cli ping > /dev/null; then
    echo "✅ Redis: OK"
else
    echo "❌ Redis: FAILED"
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: OK"
else
    echo "❌ Nginx: FAILED"
fi
```

---

## Scaling

### Horizontal Scaling

For high traffic, consider:

1. **Load Balancer** - Nginx or HAProxy in front
2. **Multiple Backend Servers** - Run Gunicorn on multiple servers
3. **Database Replication** - PostgreSQL read replicas
4. **Redis Cluster** - For high availability
5. **CDN** - CloudFlare or AWS CloudFront for static files

### Vertical Scaling

Simple upgrades:
- More RAM for database caching
- More CPU cores (increase Gunicorn workers)
- Faster SSD for database performance

---

## Deployment Checklist

Before going live:

- [ ] All default passwords changed
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Backups tested
- [ ] Monitoring set up
- [ ] Error logging configured
- [ ] Performance tested
- [ ] Security headers configured
- [ ] CORS configured correctly
- [ ] Email notifications tested
- [ ] SMS notifications tested (if enabled)

---

## Updating Production

```bash
# Pull latest code
cd ~/gatepass
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
deactivate

# Update frontend
cd ../frontend
npm ci
npm run build

# Restart services
sudo supervisorctl restart gatepass:*
```

Consider creating a deployment script for automation.

---

## Getting Help

- Review logs first
- Check [Troubleshooting Guide](TROUBLESHOOTING.md)
- Open an issue on [GitHub](https://github.com/kaleaditya28897-linux/gatepass/issues)
