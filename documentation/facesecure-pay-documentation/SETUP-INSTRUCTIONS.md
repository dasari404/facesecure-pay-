# FaceSecure Pay - Database Setup Instructions

## Current Issue
The database connection is failing. This is likely because:
1. The MySQL user 'akki' doesn't have permissions to the 'nada' database
2. Or the password is different

## Manual Setup (Recommended)

### Step 1: Connect to MySQL
Open MySQL Workbench or command line and connect with your admin credentials.

### Step 2: Create/Grant Permissions
Run these commands:

```sql
-- If you need to create the user (skip if already exists)
CREATE USER IF NOT EXISTS 'akki'@'localhost' IDENTIFIED BY 'akki123';

-- Grant all permissions on the nada database
GRANT ALL PRIVILEGES ON nada.* TO 'akki'@'localhost';
FLUSH PRIVILEGES;

-- Use the database
USE nada;
```

### Step 3: Run the Schema
Copy and paste the entire contents of `backend/config/schema.sql` into your MySQL client and execute it.

This will create all necessary tables:
- admins
- users  
- face_registrations
- transactions
- user_reports
- report_updates

### Step 4: Verify Setup
Run this query to verify tables were created:

```sql
SHOW TABLES;
```

You should see 6 tables listed.

### Step 5: Restart the Backend Server
After the database is set up:

```bash
cd backend
npm start
```

## Alternative: Update Credentials

If you know the correct MySQL credentials, update `backend/.env`:

```env
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password  
DB_NAME=nada
```

Then run:
```bash
cd backend
npm run setup
```

## Testing the API

Once the database is set up and server is running, you can test:

1. **Register a user:**
   - Open `frontend/register.html` in browser (via Live Server on port 5500)
   - Fill in the form and submit
   - You should get ₹1000 starting balance

2. **Login:**
   - Use the email/password you just registered
   - You'll be redirected to transactions page

3. **Send money:**
   - Create a second user account (different email)
   - Login with first user
   - Send money to second user's email
   - Complete face verification
   - Check balances updated

## Default Admin Credentials

Username: `admin`  
Password: `admin123`

Access admin panel at: `frontend/admin-login.html`
