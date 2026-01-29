# GatePass User Guide

Welcome to GatePass! This guide will help you understand how to use the system based on your role.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles](#user-roles)
3. [Admin Guide](#admin-guide)
4. [Company Admin Guide](#company-admin-guide)
5. [Employee Guide](#employee-guide)
6. [Guard Guide](#guard-guide)
7. [Common Tasks](#common-tasks)

---

## Getting Started

### Logging In

1. Open your web browser
2. Go to your GatePass URL (e.g., http://localhost:5173)
3. Enter your username and password
4. Click "Login"

![Login Screen](images/login.png)

### Dashboard

After logging in, you'll see your dashboard with relevant information based on your role:

- **Stats Cards** - Quick overview of important numbers
- **Navigation Menu** - Access different features
- **User Menu** - Log out and view profile

---

## User Roles

GatePass has four user roles with different permissions:

| Role | Description | Can Do |
|------|-------------|--------|
| **Admin** | System administrator | Everything |
| **Company Admin** | Manages a single company | Manage employees, approve passes |
| **Employee** | Regular company employee | Create visitor passes, track deliveries |
| **Guard** | Security personnel | Check-in visitors, verify deliveries |

---

## Admin Guide

As an Admin, you have full control over the system.

### Managing Companies

**To add a new company:**

1. Go to **Companies** in the sidebar
2. Click **"Add Company"** button
3. Fill in the company details:
   - **Name** - Company name (e.g., "Acme Corporation")
   - **Slug** - URL-friendly name (e.g., "acme-corp")
   - **Floor** - Floor number/name
   - **Suite Number** - Office number
   - **Email** - Company contact email
   - **Phone** - Company phone number
   - **Max Employees** - Employee limit
4. Click **"Create"**

**To assign a Company Admin:**

1. First, create a user with the "Company Admin" role
2. Edit the company
3. Select the admin user in the "Admin" dropdown
4. Save changes

### Managing Gates

Gates are entry/exit points in your building.

**To add a new gate:**

1. Go to **Gates** in the sidebar
2. Click **"Add Gate"**
3. Fill in:
   - **Name** - Gate name (e.g., "Main Entrance")
   - **Code** - Unique code (e.g., "GATE-A")
   - **Location** - Where it's located
   - **Type** - Pedestrian, Vehicle, or Service
4. Click **"Create"**

### Managing Guards

**To add a new guard:**

1. Go to **Guards** in the sidebar
2. Click **"Add Guard"**
3. Fill in guard details including badge number
4. Click **"Create"**

**To assign a guard to a gate (create shift):**

1. Go to **Shifts** section
2. Click **"Add Shift"**
3. Select guard, gate, and shift times
4. Click **"Create"**

### Viewing Analytics

1. Go to **Dashboard** (home)
2. View statistics:
   - Total companies
   - Today's entries
   - Active visitors
   - Pending deliveries
3. See charts for entry trends

### Viewing Audit Logs

1. Go to **Audit Logs**
2. Filter by:
   - User
   - Action type
   - Date range
3. Review all system activities

---

## Company Admin Guide

As a Company Admin, you manage your company's employees and approve visitor passes.

### Managing Employees

**To add an employee:**

1. Go to **Employees**
2. Click **"Add Employee"**
3. Fill in:
   - Username
   - Email
   - First/Last Name
   - Phone
   - Password
   - Employee ID
   - Designation
   - Department
4. Click **"Create"**

**To bulk import employees:**

1. Go to **Employees**
2. Click **"Bulk Upload"**
3. Download the CSV template
4. Fill in employee data
5. Upload the CSV file

### Approving Visitor Passes

When employees create visitor passes, they need your approval:

1. Go to **Passes**
2. Find passes with "Pending" status
3. Review the visitor details:
   - Who they're visiting
   - Purpose of visit
   - Date/time
4. Click **"Approve"** or **"Reject"**

When approved:
- A QR code is generated
- The visitor receives notification (if configured)

### Viewing Company Statistics

Your dashboard shows:
- Number of employees
- Active visitor passes
- Today's entries
- Pending deliveries

---

## Employee Guide

As an Employee, you can create visitor passes and track your deliveries.

### Creating a Visitor Pass

When you're expecting a visitor:

1. Go to **My Passes**
2. Click **"New Pass"**
3. Fill in visitor details:
   - **Visitor Name** - Full name
   - **Phone** - Mobile number (for notifications)
   - **Email** - Email address (optional)
   - **Company** - Visitor's company (optional)
   - **Purpose** - Reason for visit
   - **Valid From** - When they can arrive
   - **Valid Until** - When pass expires
4. Click **"Create Pass"**

The pass will be sent to your Company Admin for approval.

**After approval:**
- The visitor receives a link with their QR code
- Share this link with your visitor
- They show the QR at the gate

### Tracking Your Passes

1. Go to **My Passes**
2. See all your passes and their status:
   - **Pending** - Waiting for approval
   - **Approved** - Ready to use
   - **Checked In** - Visitor is in the building
   - **Checked Out** - Visit completed
   - **Expired** - Pass has expired
   - **Rejected** - Not approved

### Managing Deliveries

When you're expecting a food order or package:

1. Go to **My Deliveries**
2. Click **"Add Delivery"**
3. Fill in:
   - **Type** - Food Order, Courier, Document, Other
   - **Platform** - Swiggy, Zomato, Amazon, etc.
   - **Order ID** - Order number (optional)
   - **Expected At** - When it should arrive
   - **Notes** - Any special instructions
4. Click **"Add Delivery"**

**Important:** You'll receive an **OTP** (6-digit code). Share this with the delivery person.

When the delivery arrives:
1. Guard marks it as "Arrived"
2. You're notified
3. Guard verifies OTP
4. You collect your delivery

---

## Guard Guide

As a Guard, you manage gate operations - checking in visitors and verifying deliveries.

### Starting Your Shift

1. Log in to GatePass
2. Your dashboard shows your current shift and gate assignment
3. If not assigned, contact your Admin

### Checking In a Visitor

**Method 1: QR Code Scan**

1. Go to **Scan QR**
2. Ask visitor to show their QR code
3. Enter the pass code (or use camera to scan)
4. Select your gate
5. Click **"Verify Pass"**
6. Review visitor details
7. If valid, click **"Check In"**

**Method 2: Walk-in Visitor**

For visitors without a pre-approved pass:

1. Go to **Scan QR**
2. Click **"Walk-in Pass"** (if enabled)
3. Fill in visitor details
4. The pass is auto-approved
5. Visitor is checked in

### Checking Out a Visitor

1. Go to **Active Visitors**
2. Find the visitor
3. Click **"Check Out"**

The visitor's pass is updated to "Checked Out".

### Managing Deliveries

1. Go to **Deliveries**
2. See all pending deliveries

**When delivery person arrives:**

1. Find the matching delivery
2. Click **"Arrived"**
3. The employee is notified
4. Ask delivery person for OTP
5. Click **"Verify OTP"**
6. Enter the 6-digit code
7. If correct, click **"Mark Delivered"**

### Viewing Active Visitors

The **Active Visitors** page shows:
- Everyone currently in the building
- When they checked in
- Which company they're visiting
- Quick check-out button

This list auto-refreshes every 30 seconds.

---

## Common Tasks

### Changing Your Password

1. Contact your Admin to reset your password
2. Or use the Django admin panel (if you have access)

### Viewing Public Pass Page

Visitors can view their pass details at:
```
http://yoursite.com/pass/[pass-code]
```

This page shows:
- Visitor name
- Host company and employee
- Valid dates
- QR code (if approved)
- Current status

### Understanding Pass Statuses

| Status | Meaning |
|--------|---------|
| Pending | Waiting for approval |
| Approved | Ready to use, QR generated |
| Checked In | Visitor is in building |
| Checked Out | Visit completed |
| Expired | Pass validity ended |
| Rejected | Not approved |
| Cancelled | Cancelled by creator |

### Understanding Delivery Statuses

| Status | Meaning |
|--------|---------|
| Expected | Waiting for delivery |
| Arrived | Delivery person at gate |
| Delivered | Successfully delivered |
| Rejected | Rejected at gate |
| Cancelled | Cancelled by employee |

---

## Tips & Best Practices

### For Employees

1. **Create passes early** - Give time for approval
2. **Be specific about visit times** - Helps guards plan
3. **Add delivery expectations** - Avoid confusion at gate
4. **Keep OTPs private** - Share only with delivery person

### For Company Admins

1. **Review passes promptly** - Don't keep visitors waiting
2. **Set reasonable validity periods** - Not too long
3. **Keep employee list updated** - Remove departed employees

### For Guards

1. **Verify ID** - Match visitor to pass details
2. **Check validity** - Ensure pass hasn't expired
3. **Always check out** - Accurate records matter
4. **Report issues** - Unusual activities should be logged

### For Admins

1. **Regular audits** - Review audit logs weekly
2. **Update guard shifts** - Keep schedules current
3. **Monitor analytics** - Spot trends and issues
4. **Backup regularly** - Protect your data

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `Esc` | Close dialog |
| `Enter` | Submit form |

---

## Getting Help

If you encounter issues:

1. Check the [FAQ](FAQ.md)
2. Review [Troubleshooting](TROUBLESHOOTING.md)
3. Contact your system administrator
4. Report bugs on [GitHub](https://github.com/kaleaditya28897-linux/gatepass/issues)
