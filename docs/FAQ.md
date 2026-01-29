# Frequently Asked Questions (FAQ)

## General Questions

### What is GatePass?

GatePass is an open-source visitor management and access control system designed for business centers, corporate offices, and multi-tenant buildings. It helps manage:
- Visitor passes and check-ins
- Delivery tracking (food orders, couriers)
- Security guard operations
- Entry/exit logging
- Analytics and reporting

### Is GatePass free?

Yes! GatePass is 100% free and open-source under the MIT license. You can use, modify, and distribute it freely.

### What are the system requirements?

**Minimum:**
- 2 CPU cores
- 2 GB RAM
- 5 GB storage
- Linux (Ubuntu, Debian, Fedora, or Arch)

**Recommended for production:**
- 4 CPU cores
- 8 GB RAM
- 50 GB SSD storage

### Can I use GatePass on Windows?

The application is designed for Linux servers. However, you can:
- Use Docker on Windows
- Use WSL2 (Windows Subsystem for Linux)
- Deploy to a Linux cloud server

---

## Installation Questions

### The installer fails. What should I do?

1. Check the log file: `~/gatepass/install.log`
2. Ensure you have internet connectivity
3. Make sure you have sudo permissions
4. Try running individual commands manually
5. Check [Troubleshooting Guide](TROUBLESHOOTING.md)

### How do I update GatePass?

```bash
cd ~/gatepass
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
deactivate

# Update frontend
cd ../frontend
npm install
npm run build  # For production

# Restart services
./stop.sh && ./start.sh
```

### Can I install on a Raspberry Pi?

Technically yes, but performance may be limited. We recommend:
- Raspberry Pi 4 with 4GB+ RAM
- Use a fast SD card or SSD
- Expect slower response times

---

## Usage Questions

### How do visitors get their QR code?

1. An employee creates a visitor pass
2. Company admin approves the pass
3. System generates a QR code
4. Visitor receives:
   - SMS with link (if SMS is configured)
   - Email with link (if email is configured)
   - Employee can share the link directly

The link looks like: `https://yoursite.com/pass/abc123-uuid`

### Can a visitor check in multiple times?

No. Each pass has one check-in. After check-out, the pass is marked "Checked Out". For recurring visitors, create a "Recurring" pass type with appropriate validity dates.

### How does the delivery OTP system work?

1. Employee creates a delivery expectation
2. System generates a 6-digit OTP
3. Employee shares OTP with delivery person
4. When delivery arrives at gate:
   - Guard marks as "Arrived"
   - Employee gets notified
   - Guard enters OTP to verify
   - Guard marks as "Delivered"

### Can I customize the QR code design?

Currently, QR codes are generated with default settings. You can modify the code in `backend/apps/passes/views.py` to customize:
- QR code size
- Error correction level
- Colors (with caution - may affect scanning)

### How do I add a new company?

**As Admin:**
1. Go to Companies → Add Company
2. Fill in details
3. Create a user with "Company Admin" role
4. Assign that user as the company admin

### Can employees see other employees' visitors?

No. Employees can only see:
- Passes they created
- Deliveries they created

Company Admins can see all passes/deliveries for their company.

---

## Technical Questions

### How do I change the database password?

1. Update PostgreSQL:
```sql
ALTER USER gatepass WITH PASSWORD 'new_password';
```

2. Update `.env`:
```
DB_PASSWORD=new_password
```

3. Restart services:
```bash
./stop.sh && ./start.sh
```

### How do I reset the admin password?

```bash
cd ~/gatepass/backend
source venv/bin/activate
python manage.py shell
```

```python
from django.contrib.auth import get_user_model
User = get_user_model()
admin = User.objects.get(username='admin')
admin.set_password('new_password')
admin.save()
exit()
```

### How do I backup the database?

```bash
# Backup
pg_dump -U gatepass gatepass > backup.sql

# Restore
psql -U gatepass gatepass < backup.sql
```

### Can I use MySQL instead of PostgreSQL?

The application is designed for PostgreSQL. Using MySQL would require:
- Changing database driver
- Potentially modifying some queries
- Adjusting settings

We recommend sticking with PostgreSQL.

### How do I enable SMS notifications?

1. Sign up for Twilio (or MSG91)
2. Get your credentials
3. Update `.env`:
```
SMS_BACKEND=twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1234567890
```
4. Restart the application

### Why aren't emails being sent?

Check:
1. Email settings in `.env`
2. Celery worker is running
3. Email credentials are correct
4. Check spam folder
5. View Celery logs for errors

For Gmail, you need an "App Password" not your regular password.

### How do I view API documentation?

The API follows REST conventions. See `README.md` for endpoint documentation. For interactive docs, you could add Swagger/OpenAPI.

---

## Security Questions

### Is GatePass secure?

GatePass includes several security features:
- JWT authentication with token expiration
- Password hashing (Django's PBKDF2)
- CORS protection
- SQL injection protection (Django ORM)
- XSS protection
- CSRF protection

For production, ensure you:
- Use HTTPS
- Set strong passwords
- Keep software updated
- Configure firewall
- Review audit logs

### How do I audit user actions?

GatePass logs all important actions in the Audit Log:
- Login/logout
- Pass creation/approval
- Check-ins/check-outs
- Delivery verifications

Admins can view these at: Dashboard → Audit Logs

### Can I restrict IP addresses?

Yes, configure this in Nginx:

```nginx
location /api/ {
    allow 192.168.1.0/24;
    deny all;
    # ... rest of config
}
```

### How long are JWT tokens valid?

Default settings:
- Access token: 1 hour
- Refresh token: 7 days

Modify in `settings/base.py`:
```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
```

---

## Customization Questions

### Can I change the branding/logo?

Yes! Modify:
- Frontend: `src/components/common/AppShell.tsx` - Logo component
- Login page: `src/pages/LoginPage.tsx`
- CSS: `src/index.css` - Colors and theme

### Can I add custom fields to passes?

You'll need to:
1. Add field to `backend/apps/passes/models.py`
2. Create migration: `python manage.py makemigrations`
3. Apply migration: `python manage.py migrate`
4. Update serializers and frontend forms

### Can I change the QR code URL format?

Modify `backend/apps/passes/views.py`:
```python
def generate_qr_code(pass_obj):
    url = f"{settings.FRONTEND_URL}/pass/{pass_obj.pass_code}"
    # Change URL format here
```

### How do I add a new user role?

1. Add to `backend/apps/accounts/models.py`:
```python
class Role(models.TextChoices):
    # ... existing roles
    NEW_ROLE = "new_role", "New Role"
```

2. Create permission class in `permissions.py`
3. Add navigation in frontend `AppShell.tsx`
4. Create role-specific pages

---

## Troubleshooting Questions

### Why do I get "Connection Refused"?

This usually means a service isn't running:
- PostgreSQL: `sudo systemctl start postgresql`
- Redis: `sudo systemctl start redis-server`
- Backend: `python manage.py runserver`

### Why is the frontend showing a blank page?

1. Check browser console for errors (F12)
2. Ensure backend is running
3. Check VITE_API_URL in `.env.local`
4. Try clearing browser cache

### Why can't I log in?

1. Check username/password are correct
2. Ensure user is active (not disabled)
3. Check backend logs for errors
4. Try resetting password (see above)

### Why isn't the QR scanner working?

QR scanning requires:
- HTTPS (camera access requires secure context)
- Camera permission granted
- Modern browser (Chrome, Firefox, Safari)

For local development with HTTP, the scanner may not work. Use manual pass code entry instead.

---

## Contact & Support

- **GitHub Issues:** [Report bugs](https://github.com/kaleaditya28897-linux/gatepass/issues)
- **Documentation:** [Full docs](./README.md)
- **Community:** Coming soon

---

Still have questions? Open an issue on GitHub!
