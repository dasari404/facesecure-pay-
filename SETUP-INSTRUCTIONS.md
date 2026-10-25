# FaceSecure Pay - Complete Setup Guide

Complete guide to set up and run FaceSecure Pay with backend API and frontend.

## System Requirements

- **Node.js** v14+ ([Download](https://nodejs.org/))
- **MySQL** v5.7+ ([Download](https://dev.mysql.com/downloads/mysql/))
- **Web Browser** (Chrome, Firefox, Edge)
- **Code Editor** (VS Code recommended with Live Server extension)

---

## Part 1: Backend Setup

### Step 1: Install MySQL

1. Download and install MySQL
2. During installation, remember your **root password**
3. Verify installation:
   ```bash
   mysql --version
   ```

### Step 2: Configure Backend

1. Navigate to backend folder:
   ```bash
   cd facesecure-pay/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Edit `.env` file with your MySQL password:
   ```env
   DB_PASSWORD=your_mysql_password_here
   ```

### Step 3: Setup Database

Run the database setup script:
```bash
npm run setup
```

You should see:
```
✅ Connected to MySQL server
✅ Database 'facesecure_pay' created/verified
✅ Database schema created successfully
📋 Created tables:
   - admins
   - users
   - transactions
   - face_registrations
   - user_reports
   - report_updates
👤 Default admin account:
   Username: admin
   Password: admin123
✅ Database setup completed successfully!
```

### Step 4: Start Backend Server

```bash
npm start
```

You should see:
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          🔐 FaceSecure Pay API Server                    ║
║                                                           ║
║  Server running on: http://localhost:3000                ║
║  Environment: development                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
✅ Database connected successfully
```

**Keep this terminal window open!** The backend server must be running.

---

## Part 2: Frontend Setup

### Step 1: Install Live Server (VS Code)

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Live Server" by Ritwick Dey
4. Click Install

### Step 2: Start Frontend

1. Open the `frontend` folder in VS Code
2. Right-click on `index.html`
3. Select **"Open with Live Server"**
4. Your browser will open at `http://127.0.0.1:5500`

---

## Part 3: Testing the Setup

### Test 1: Check Backend API

Open browser and visit: http://localhost:3000/health

You should see:
```json
{
  "success": true,
  "message": "FaceSecure Pay API is running",
  "timestamp": "2024-..."
}
```

### Test 2: Admin Login

1. Open: http://127.0.0.1:5500/admin-login.html
2. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
3. Click "Sign In to Dashboard"
4. You should be redirected to the admin dashboard

### Test 3: Submit a Report

1. Open: http://127.0.0.1:5500/index.html
2. Scroll to "Report Fraud" section
3. Fill out the form:
   - Report Type: Fraud
   - Subject: "Test Report"
   - Description: "Testing the report system"
   - Your Email: "test@example.com"
4. Click "Submit Report"
5. You'll receive a reference number like: **FS123ABC**

### Test 4: Check Report Status

1. On the landing page, find "Check Status" section
2. Enter your reference number: `FS123ABC`
3. Click "Check Status"
4. You should see report details with status "Submitted"

### Test 5: View Report in Admin Dashboard

1. Go to admin dashboard (already logged in)
2. Click "User Reports" in sidebar
3. You should see your test report in the table

---

## Quick Start Commands

### Backend
```bash
# Navigate to backend
cd facesecure-pay/backend

# Install dependencies (first time only)
npm install

# Setup database (first time only)
npm run setup

# Start server
npm start

# Start with auto-reload (development)
npm run dev
```

### Frontend
```bash
# Just open with Live Server in VS Code
# Or use any local server on port 5500
```

---

## Default Credentials

### Admin Dashboard
- URL: http://127.0.0.1:5500/admin-login.html
- Username: `admin`
- Password: `admin123`

⚠️ **Change password after first login!**

---

## Troubleshooting

### Backend won't start

**Error: "connect ECONNREFUSED"**
- MySQL is not running
- Solution: Start MySQL service
  ```bash
  # Windows (as admin)
  net start MySQL80
  
  # Mac
  mysql.server start
  
  # Linux
  sudo systemctl start mysql
  ```

**Error: "Access denied for user 'root'"**
- Wrong password in `.env`
- Solution: Update `DB_PASSWORD` in `.env`

**Error: "Port 3000 already in use"**
- Another app is using port 3000
- Solution: Change `PORT=3001` in `.env`

### Frontend won't load

**Page shows but API calls fail**
- Backend server not running
- Solution: Start backend with `npm start`

**"CORS error" in browser console**
- Wrong origin in backend config
- Solution: Check `CORS_ORIGIN` in backend `.env`

### Report submission fails

**"Failed to submit report"**
- Check browser console (F12) for error
- Verify backend is running on port 3000
- Check `frontend/js/config.js` has correct API URL

---

## File Structure

```
facesecure-pay/
├── backend/
│   ├── config/
│   │   ├── database.js       # Database connection
│   │   └── schema.sql        # Database tables
│   ├── middleware/
│   │   └── auth.js           # JWT authentication
│   ├── routes/
│   │   ├── admin.js          # Admin API endpoints
│   │   └── reports.js        # Report API endpoints
│   ├── .env                  # Environment config
│   ├── server.js             # Main server
│   ├── setup-database.js     # DB setup script
│   └── package.json          # Dependencies
│
├── frontend/
│   ├── js/
│   │   ├── config.js         # API configuration
│   │   ├── admin.js          # Admin dashboard logic
│   │   ├── reports.js        # Report form handling
│   │   └── ...
│   ├── styles/
│   │   ├── main.css          # Landing page styles
│   │   ├── admin.css         # Admin dashboard styles
│   │   └── auth.css          # Authentication styles
│   ├── index.html            # Landing page
│   ├── admin.html            # Admin dashboard
│   └── admin-login.html      # Admin login
│
├── PROJECT_REQUIREMENTS.md   # Project specs
├── FACE_VERIFICATION_PLAN.md # Face verification docs
└── SETUP-INSTRUCTIONS.md     # This file
```

---

## API Endpoints Reference

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health check |
| POST | `/api/reports/submit` | Submit fraud report |
| GET | `/api/reports/status/:ref` | Check report status |

### Admin Endpoints (Requires Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin authentication |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/activity` | Recent activity |
| GET | `/api/reports/admin/all` | Get all reports |
| GET | `/api/reports/admin/stats` | Report statistics |
| PATCH | `/api/reports/admin/:id/status` | Update report status |
| PATCH | `/api/reports/admin/:id/assign` | Assign report |

---

## Next Steps

Now that everything is set up:

1. **Test all features** - Submit reports, check status, view in admin
2. **Customize design** - Edit CSS files in `frontend/styles/`
3. **Add more features** - Refer to PROJECT_REQUIREMENTS.md
4. **Implement face verification** - See FACE_VERIFICATION_PLAN.md
5. **Add user authentication** - Register/login for customers
6. **Build transaction system** - Send/receive money

---

## Getting Help

- Check `backend/README.md` for backend details
- Review browser console (F12) for frontend errors
- Check backend terminal for server errors
- Verify database with: `mysql -u root -p` → `USE facesecure_pay;` → `SHOW TABLES;`

---

## Security Notes

- Default admin password should be changed
- Never commit `.env` file to git
- Use HTTPS in production
- Set strong JWT_SECRET in production
- Enable rate limiting in production

---

Good luck building FaceSecure Pay! 🚀
