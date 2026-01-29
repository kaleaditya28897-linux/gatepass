# Troubleshooting Guide

This guide helps you diagnose and fix common issues with GatePass.

---

## Quick Diagnostics

Run the status script to check all services:

```bash
cd ~/gatepass
./status.sh
```

This shows the status of:
- Backend server
- Frontend server
- PostgreSQL database
- Redis server

---

## Installation Issues

### "Command not found" errors

**Problem:** Commands like `python3`, `pip`, or `npm` not found.

**Solution:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y python3 python3-pip nodejs npm

# Fedora
sudo dnf install -y python3 python3-pip nodejs npm

# Arch
sudo pacman -S python python-pip nodejs npm
```

### "Permission denied" errors

**Problem:** Can't install packages or run scripts.

**Solution:**
```bash
# For pip - use --user flag or virtual environment
pip install --user package_name

# For npm - fix permissions
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# For scripts
chmod +x script.sh
```

### "No space left on device"

**Problem:** Disk is full.

**Solution:**
```bash
# Check disk usage
df -h

# Find large files
du -sh /* | sort -h | tail -20

# Clean package caches
# Ubuntu/Debian
sudo apt clean

# Fedora
sudo dnf clean all

# Arch
sudo pacman -Scc
```

---

## Database Issues

### "Connection refused" to PostgreSQL

**Problem:** Can't connect to PostgreSQL database.

**Solutions:**

1. **Check if PostgreSQL is running:**
```bash
sudo systemctl status postgresql
# If not running:
sudo systemctl start postgresql
```

2. **Check PostgreSQL is listening:**
```bash
sudo netstat -tlnp | grep 5432
# Should show postgres listening on 5432
```

3. **Check authentication:**
```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf
# or
sudo nano /var/lib/pgsql/data/pg_hba.conf

# Change "peer" to "md5" for local connections:
# local   all   all   md5
```

4. **Verify credentials:**
```bash
psql -U gatepass -d gatepass -h localhost
# Enter password when prompted
```

### "Database does not exist"

**Problem:** The gatepass database wasn't created.

**Solution:**
```bash
sudo -u postgres psql
CREATE DATABASE gatepass;
CREATE USER gatepass WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE gatepass TO gatepass;
\q
```

### "Migration errors"

**Problem:** `python manage.py migrate` fails.

**Solutions:**

1. **Check database connection:**
```bash
# Verify .env settings
cat ~/gatepass/backend/.env | grep DB_
```

2. **Reset migrations (CAUTION - loses data):**
```bash
# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE gatepass;"
sudo -u postgres psql -c "CREATE DATABASE gatepass OWNER gatepass;"

# Re-run migrations
python manage.py migrate
```

3. **Check for syntax errors:**
```bash
python manage.py check
```

---

## Redis Issues

### "Connection refused" to Redis

**Problem:** Can't connect to Redis.

**Solutions:**

1. **Check if Redis is running:**
```bash
# Check status
sudo systemctl status redis-server  # Ubuntu/Debian
sudo systemctl status redis         # Fedora/Arch

# Start if not running
sudo systemctl start redis-server
```

2. **Test Redis connection:**
```bash
redis-cli ping
# Should return: PONG
```

3. **Check Redis is listening:**
```bash
sudo netstat -tlnp | grep 6379
```

### "Celery worker not processing tasks"

**Problem:** Background tasks (notifications) not working.

**Solutions:**

1. **Check Celery is running:**
```bash
ps aux | grep celery
```

2. **Start Celery manually:**
```bash
cd ~/gatepass/backend
source venv/bin/activate
celery -A gatepass worker --loglevel=debug
```

3. **Check Celery logs:**
```bash
tail -f /var/log/gatepass/celery.log
```

---

## Backend Issues

### "ModuleNotFoundError"

**Problem:** Python can't find a module.

**Solutions:**

1. **Activate virtual environment:**
```bash
cd ~/gatepass/backend
source venv/bin/activate
```

2. **Reinstall dependencies:**
```bash
pip install -r requirements.txt
```

3. **Check Python version:**
```bash
python --version
# Should be 3.10+
```

### "Server Error (500)"

**Problem:** Backend returns 500 error.

**Solutions:**

1. **Check backend logs:**
```bash
# If using start.sh
tail -f ~/gatepass/backend/debug.log

# If using supervisor
tail -f /var/log/gatepass/backend.log
```

2. **Enable debug mode (development only):**
```bash
# In .env
DEBUG=True
```

3. **Check Django errors:**
```bash
cd ~/gatepass/backend
source venv/bin/activate
python manage.py check
python manage.py runserver
# Watch for errors in output
```

### "CORS error"

**Problem:** Frontend can't access backend API.

**Solutions:**

1. **Check CORS settings in backend .env:**
```bash
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

2. **For development, allow all origins:**
```python
# In settings/development.py
CORS_ALLOW_ALL_ORIGINS = True
```

3. **Clear browser cache and try again.**

### "JWT token expired"

**Problem:** Getting 401 errors after being logged in.

**Solutions:**

1. **Log out and log back in.**

2. **Clear browser localStorage:**
```javascript
// In browser console
localStorage.clear()
```

3. **Check token lifetime in settings:**
```python
# settings/base.py
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
```

---

## Frontend Issues

### "npm install fails"

**Problem:** Can't install Node.js packages.

**Solutions:**

1. **Clear npm cache:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

2. **Check Node.js version:**
```bash
node --version
# Should be v18 or higher
```

3. **Use specific npm registry:**
```bash
npm install --registry https://registry.npmjs.org
```

### "Blank page in browser"

**Problem:** Frontend shows nothing.

**Solutions:**

1. **Check browser console (F12) for errors.**

2. **Verify API URL:**
```bash
cat ~/gatepass/frontend/.env.local
# Should have: VITE_API_URL=http://localhost:8000/api/v1
```

3. **Rebuild frontend:**
```bash
cd ~/gatepass/frontend
npm run build
```

4. **Check backend is running:**
```bash
curl http://localhost:8000/api/v1/
```

### "API request failed"

**Problem:** Frontend can't communicate with backend.

**Solutions:**

1. **Verify backend URL in browser:**
   - Open: http://localhost:8000/api/v1/
   - Should see JSON response

2. **Check network tab in browser DevTools (F12)**
   - Look for failed requests
   - Check request/response details

3. **Verify both servers are running:**
```bash
./status.sh
```

---

## QR Code Issues

### "QR code not generating"

**Problem:** Approved passes don't have QR codes.

**Solutions:**

1. **Check Pillow is installed:**
```bash
pip show pillow qrcode
```

2. **Check media directory exists and is writable:**
```bash
ls -la ~/gatepass/backend/media/
mkdir -p ~/gatepass/backend/media/qr_codes
chmod 755 ~/gatepass/backend/media/qr_codes
```

3. **Manually generate QR:**
```bash
python manage.py shell
```
```python
from apps.passes.models import VisitorPass
from apps.passes.views import generate_qr_code
pass_obj = VisitorPass.objects.first()
generate_qr_code(pass_obj)
```

### "QR scanner not working"

**Problem:** Camera scanner doesn't activate.

**Solutions:**

1. **Use HTTPS:** Camera access requires secure context.

2. **Grant camera permission in browser.**

3. **Use supported browser:** Chrome, Firefox, Safari.

4. **Fallback:** Enter pass code manually.

---

## Performance Issues

### "Application is slow"

**Problem:** Pages take long to load.

**Solutions:**

1. **Check server resources:**
```bash
top
htop
free -m
```

2. **Optimize PostgreSQL:**
```bash
# Increase shared_buffers in postgresql.conf
shared_buffers = 256MB  # 25% of RAM
```

3. **Add database indexes (already included in migrations).**

4. **Enable caching (Redis is already configured).**

5. **Use production builds:**
```bash
# Frontend
npm run build  # Not npm run dev
```

### "Database queries slow"

**Problem:** API responses are slow.

**Solutions:**

1. **Analyze slow queries:**
```sql
-- In PostgreSQL
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

2. **Run VACUUM:**
```bash
sudo -u postgres psql -d gatepass -c "VACUUM ANALYZE;"
```

---

## Service Management

### Manually Starting Services

```bash
# PostgreSQL
sudo systemctl start postgresql

# Redis
sudo systemctl start redis-server  # Ubuntu/Debian
sudo systemctl start redis         # Fedora/Arch

# Backend (development)
cd ~/gatepass/backend
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000

# Celery (separate terminal)
celery -A gatepass worker --loglevel=info

# Frontend (development)
cd ~/gatepass/frontend
npm run dev
```

### Checking Service Logs

```bash
# PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# Redis
sudo tail -f /var/log/redis/redis-server.log

# Nginx (production)
sudo tail -f /var/log/nginx/gatepass_error.log

# Application (production)
sudo tail -f /var/log/gatepass/backend.log
sudo tail -f /var/log/gatepass/celery.log
```

---

## Getting Help

If you can't resolve an issue:

1. **Collect information:**
   - Error messages
   - Log outputs
   - Steps to reproduce
   - System info (`uname -a`, `cat /etc/os-release`)

2. **Search existing issues:**
   [GitHub Issues](https://github.com/kaleaditya28897-linux/gatepass/issues)

3. **Open a new issue with:**
   - Clear description
   - Error logs
   - System information
   - What you've tried

---

## Common Error Messages

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| "Connection refused" | Service not running | Start the service |
| "Permission denied" | Wrong file permissions | `chmod` / `chown` |
| "Module not found" | Missing dependency | `pip install` / `npm install` |
| "CORS error" | Backend misconfigured | Check CORS settings |
| "401 Unauthorized" | Invalid/expired token | Log in again |
| "500 Server Error" | Backend exception | Check backend logs |
| "Database error" | PostgreSQL issue | Check DB connection |
