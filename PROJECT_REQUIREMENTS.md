# FacePay - Digital Payment System with Fraud Detection

## Project Overview
FacePay is a simulated digital payment website designed to provide users with a secure environment for transferring virtual money while detecting and preventing fraudulent transactions.

---

## Core Features

### 1. User Registration & Authentication
- **Registration Fields:**
  - Name
  - Email Address
  - Phone Number
  - Password (secure hashing)
- **Starting Balance:** ₹1,000 virtual money for every new user
- **Login System:** Email/Phone + Password

### 2. User Dashboard
- **Wallet Balance Display:** Show current virtual balance
- **Send Money:** Transfer to other users via email, phone, or user ID
- **Receive Money:** Accept transfers from other users
- **Transaction History:** Complete list of all transactions

### 3. Transaction Management
**Every Transaction Includes:**
- Unique Transaction ID
- Date & Time
- Amount
- Sender Details
- Recipient Details
- Transaction Status (Completed/Blocked/Pending)

**Transaction Flow:**
1. User initiates transfer
2. System validates sender's balance
3. System checks fraud database for BOTH sender & recipient
4. If fraud match found → Block transaction, record attempt, no balance change
5. If no fraud match & sufficient funds → Complete transfer, update balances
6. Record transaction in history

### 4. Fraud Management System
**Fraud Database Contains:**
- Reported fraudulent email addresses
- Reported fraudulent phone numbers
- Reported fraudulent user accounts/IDs
- Status: Unverified Report vs Verified Fraud

**Fraud Detection:**
- Automatic check before EVERY transaction
- Check both sender AND recipient against verified fraud database
- Immediate blocking if match found
- Record blocked transaction with reason

### 5. Administrator Panel
**Admin Capabilities:**
- Review fraud reports
- Verify suspicious identifiers (mark as verified fraud)
- Manage fraud database (add/remove entries)
- Investigate blocked transactions
- View system-wide transaction analytics
- Distinguish between unverified reports and confirmed fraud

---

## Technical Stack

### Frontend
- **Technology:** HTML, CSS, JavaScript (Plain/Vanilla)
- **Pages:**
  - Registration Page
  - Login Page
  - User Dashboard
  - Send Money Page
  - Transaction History Page
  - Admin Panel (separate login)
  - Fraud Reports Page

### Backend
- **Technology:** Node.js + Express
- **Features:**
  - RESTful API endpoints
  - Secure password hashing (bcrypt)
  - Server-side transaction validation
  - Fraud checking middleware
  - Protected admin routes
  - Session management

### Database
- **Technology:** MySQL
- **Tables:**
  1. `users` - User accounts & balances
  2. `transactions` - All transaction records
  3. `fraud_reports` - Reported suspicious activities
  4. `verified_fraud` - Confirmed fraudulent identifiers
  5. `admins` - Administrator accounts
  6. `blocked_transactions` - Failed transaction attempts

---

## Database Schema

### Users Table
```sql
- id (Primary Key, Auto Increment)
- name (VARCHAR)
- email (VARCHAR, Unique)
- phone (VARCHAR, Unique)
- password_hash (VARCHAR)
- balance (DECIMAL, Default: 1000.00)
- created_at (TIMESTAMP)
- status (ENUM: active, suspended)
```

### Transactions Table
```sql
- transaction_id (Primary Key, UUID)
- sender_id (Foreign Key → users.id)
- recipient_id (Foreign Key → users.id)
- amount (DECIMAL)
- status (ENUM: completed, blocked, pending)
- timestamp (TIMESTAMP)
- description (TEXT)
```

### Fraud Reports Table
```sql
- report_id (Primary Key, Auto Increment)
- reported_identifier (VARCHAR) - email/phone/user_id
- identifier_type (ENUM: email, phone, user_id)
- reported_by (Foreign Key → users.id)
- reason (TEXT)
- status (ENUM: unverified, verified, dismissed)
- reported_at (TIMESTAMP)
```

### Verified Fraud Table
```sql
- fraud_id (Primary Key, Auto Increment)
- identifier (VARCHAR) - email/phone/user_id
- identifier_type (ENUM: email, phone, user_id)
- verified_by (Foreign Key → admins.id)
- verified_at (TIMESTAMP)
- notes (TEXT)
```

### Blocked Transactions Table
```sql
- block_id (Primary Key, Auto Increment)
- transaction_attempt_id (UUID)
- sender_id (Foreign Key → users.id)
- recipient_id (Foreign Key → users.id)
- amount (DECIMAL)
- block_reason (TEXT)
- blocked_at (TIMESTAMP)
- fraud_match_type (ENUM: sender, recipient, both)
```

### Admins Table
```sql
- admin_id (Primary Key, Auto Increment)
- username (VARCHAR, Unique)
- email (VARCHAR, Unique)
- password_hash (VARCHAR)
- created_at (TIMESTAMP)
```

---

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `POST /api/admin/login` - Admin login
- `POST /api/logout` - Logout

### User Operations
- `GET /api/user/:id` - Get user details
- `GET /api/user/:id/balance` - Get wallet balance
- `GET /api/user/search` - Search user by email/phone/id

### Transactions
- `POST /api/transaction/send` - Initiate money transfer
- `GET /api/transactions/:userId` - Get user transaction history
- `GET /api/transaction/:transactionId` - Get specific transaction

### Fraud Management
- `POST /api/fraud/report` - Report suspicious activity
- `GET /api/fraud/check` - Check if identifier is fraudulent
- `GET /api/fraud/reports` - Get all fraud reports (admin)
- `PUT /api/fraud/verify/:reportId` - Verify fraud report (admin)
- `GET /api/fraud/blocked-transactions` - Get blocked transactions (admin)

### Admin
- `GET /api/admin/dashboard` - Admin dashboard data
- `GET /api/admin/users` - List all users
- `PUT /api/admin/user/:id/status` - Suspend/activate user

---

## Security Features

1. **Password Security:**
   - Bcrypt hashing with salt rounds
   - No plain text password storage

2. **Transaction Validation:**
   - Server-side balance checks
   - Atomic database transactions (commit/rollback)
   - Prevent negative balances

3. **Fraud Detection:**
   - Real-time checking before transaction
   - Automatic blocking on match
   - Audit trail of all attempts

4. **Admin Protection:**
   - Separate admin authentication
   - Role-based access control
   - Action logging

5. **Input Validation:**
   - Sanitize all user inputs
   - Prevent SQL injection
   - XSS protection

---

## User Flow

### Registration → Login → Dashboard
1. User registers with details
2. System creates account with ₹1,000 balance
3. User logs in
4. Dashboard shows balance and recent transactions

### Send Money Flow
1. User enters recipient identifier (email/phone/ID)
2. System validates recipient exists
3. User enters amount
4. System checks:
   - Sufficient balance?
   - Sender in fraud database?
   - Recipient in fraud database?
5. If fraud match → Block & record
6. If clean → Process transfer, update balances, create transaction

### Fraud Report Flow
1. User reports suspicious activity
2. Report stored as "unverified"
3. Admin reviews report
4. Admin marks as "verified" or "dismissed"
5. If verified → Add to fraud database
6. Future transactions auto-blocked for that identifier

---

## Development Phases

### Phase 1: Setup & Authentication (HTML/CSS/JS)
- Create folder structure
- Design registration page
- Design login page
- Build frontend forms with validation

### Phase 2: Dashboard & UI
- User dashboard layout
- Send money interface
- Transaction history view
- Responsive design

### Phase 3: Backend API
- Setup Node.js + Express
- Create MySQL database & tables
- Build authentication endpoints
- Implement transaction logic

### Phase 4: Fraud Detection
- Fraud database integration
- Checking middleware
- Admin panel for verification
- Blocked transaction tracking

### Phase 5: Testing & Polish
- Test all transaction scenarios
- Test fraud detection accuracy
- UI/UX improvements
- Security hardening

---

## Key Objectives

✅ Simulate digital payments safely (no real money)
✅ Demonstrate fraud detection in action
✅ Show automatic transaction blocking
✅ Provide admin tools for fraud management
✅ Create secure, user-friendly interface
✅ Maintain complete transaction audit trail
✅ Prevent false positives (distinguish reports vs verified fraud)

---

## Notes
- This is a **simulation** - no real money involved
- No actual bank accounts required
- Virtual balances only
- Educational/demonstration purpose
- Focus on security & fraud prevention concepts
