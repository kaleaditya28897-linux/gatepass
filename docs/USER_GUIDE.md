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

As a Guard, you run the gate: checking visitors in and out and handing over deliveries.
The guard screens are built for a phone or tablet.

### Starting Your Shift

1. Log in to GatePass on the gate tablet or your phone
2. At the top of the **Dashboard**, choose the gate you are standing at under **"You are at"**
   - If the admin has rostered you on a shift, your gate is selected automatically
   - Your choice is remembered on that device
3. You cannot check anyone in until a gate is chosen

### Checking In a Visitor

**Visitor with a pass (QR code)**

1. Go to **Scan Pass**
2. Tap **"Scan QR with camera"** and point it at the visitor's QR code
   (the first time, allow the browser to use the camera)
3. No camera? Type or paste the pass code or pass link and tap **"Find"**
4. Check the visitor's details against the person in front of you
5. Tap **"Check in"**

If the pass is pending, rejected, cancelled, expired or already used, the screen says
**"Do not admit"** with the reason. A pass can be used up to 30 minutes before its start time.

**Walk-in visitor (no pass)**

1. Go to **Walk-in**
2. Enter the visitor's name and phone, pick the company and (if known) the person they are meeting
3. Optionally record the ID shown and the vehicle number
4. Tap **"Register and check in"** — the host gets an SMS that their visitor has arrived

### Checking Out a Visitor

Either:

- Scan the visitor's QR code again on **Scan Pass** and tap **"Visitor is leaving: check out"**, or
- Go to **Inside Now**, find the visitor (use the search box) and tap **"Check out"**

### Managing Deliveries

1. Go to **Deliveries** to see everything employees are expecting

**When the delivery person arrives:**

1. Find the matching delivery (search by platform, order ID or rider)
2. Tap **"Arrived"**, optionally note the rider's name and phone, and confirm
3. The employee receives an SMS with a 6-digit OTP (they can also see it in their own Deliveries page)
4. When the employee comes to collect, tap **"Enter OTP"** and type the code they give you
5. A correct code releases the delivery in one step. **Only hand it over once the code is accepted.**

After 5 wrong codes the delivery is locked; the employee must generate a new OTP from their Deliveries page.
You are never shown the OTP yourself.

### Viewing Who Is Inside

The **Inside Now** page shows everyone currently in the building, when they came in,
which company they are visiting and at which gate. It refreshes every 30 seconds.

---

## Common Tasks

### Changing Your Password

1. Click your name in the top-right corner
2. Choose **"Account & password"**
3. Enter your current password and the new one, then **"Change password"**

You can update your name, email and phone number in the same window.

**Forgot your password?** There is no self-service reset. Ask your company admin (employees)
or the building admin, who can set a new one from **Users → Reset password**.

### Viewing Public Pass Page

Visitors open the link they received by SMS or email:
```
https://your-gatepass-address/pass/[pass-code]
```

This page shows:
- Visitor name
- Host company and employee
- Valid dates
- QR code (once the pass is approved)
- Current status, with a plain explanation of what to do

It deliberately does not show the visitor's phone number or ID details.

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
| Delivered | OTP verified and handed over |
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
