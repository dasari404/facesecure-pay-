# Implementation Plan: Fix Recipient Verification 'Transaction not found' Error

## Executive Summary

**Root Cause Identified:** The `/pending-receipts` route exists and queries correct columns, but the **missing database columns in schema.sql** and **missing `/verify-sender` and `/verify-recipient` POST routes** cause the dual verification flow to fail.

**Investigation Findings:**
1. ✅ `/pending-receipts` GET route exists at line 565 in `backend/routes/transactions.js`
2. ✅ Route is correctly placed BEFORE `/:id` route to avoid path collision
3. ✅ Database has the columns (`sender_verified`, `recipient_verified`, `sender_verification_time`, `verification_stage`)
4. ❌ **Schema.sql is out of sync** - missing dual verification columns
5. ❌ **Missing `/verify-sender` POST route** - referenced by frontend but not implemented
6. ❌ **Missing `/verify-recipient` POST route** - referenced by frontend but not implemented  
7. ✅ Frontend correctly calls `API.TRANSACTIONS_VERIFY_SENDER` and `API.TRANSACTIONS_VERIFY_RECIPIENT`
8. ✅ Frontend functions `verifyTransaction()` and `verifyTransactionAsRecipient()` exist

**The Real Problem:** The backend routes `/verify-sender` and `/verify-recipient` that are being called by the frontend DO NOT EXIST in the transactions.js router, even though the code references them and has logic for dual verification.

## Codebase Context

**Project:** FaceSecure Pay - Face verification payment system with dual verification
**Stack:** Node.js/Express backend + Vanilla JS frontend
**Database:** MySQL with mysql2 driver
**Build Command:** `npm start` (backend), Live Server (frontend)
**Test Command:** None configured
**Dev Server:** Backend runs on http://localhost:3000, Frontend on http://localhost:5500

**Key Files:**
- `backend/routes/transactions.js` (966 lines) - Transaction API routes
- `backend/config/schema.sql` - Database schema (missing dual verification columns)
- `backend/config/database.js` - MySQL connection
- `frontend/js/config.js` - API endpoint definitions
- `frontend/js/transactions.js` - Transaction UI logic
- `frontend/js/face-verification.js` - Face verification flow

**Current Transaction Flow:**
1. Alice (sender) creates transaction → Status: `pending`
2. Alice verifies face → Should call `/verify-sender` → Update `sender_verified=TRUE`
3. Bob (recipient) sees in "Pending Receipts" → Calls `/pending-receipts`
4. Bob clicks "Verify Now" → Should call `/verify-recipient` → Complete transaction

## Root Causes Analysis

### Cause 1: Missing POST Routes (CRITICAL)
**Location:** `backend/routes/transactions.js`
**Problem:** The code at lines 700-850 contains logic for `sender_verified` and `recipient_verified`, but the actual POST endpoints are missing:
- Frontend calls: `POST /api/transactions/verify-sender` (defined in config.js line 30)
- Frontend calls: `POST /api/transactions/verify-recipient` (defined in config.js line 31)
- Backend has: Logic that updates these fields BUT NO ROUTES to handle these requests

**Evidence:**
- grep search for `router.post.*verify-sender` → NO MATCHES FOUND
- grep search for `router.post.*verify-recipient` → NO MATCHES FOUND
- Lines 700-850 have UPDATE logic but no route definitions

**Impact:** When frontend calls these endpoints, they hit the 404 handler because the routes don't exist.

### Cause 2: Schema Out of Sync
**Location:** `backend/config/schema.sql`
**Problem:** The schema.sql file is missing columns that exist in the actual database:
- Missing: `sender_verified BOOLEAN DEFAULT FALSE`
- Missing: `sender_verification_time TIMESTAMP NULL`
- Missing: `recipient_verified BOOLEAN DEFAULT FALSE`
- Missing: `recipient_verification_time TIMESTAMP NULL`
- Missing: `verification_stage VARCHAR(50)`
- Missing: `face_photo TEXT` in `face_registrations` table

**Evidence:** 
- Database query shows columns exist in production database
- schema.sql (read at offset 0-146) does not contain these columns
- This causes confusion and prevents fresh database setups from working

**Impact:** New developers or fresh setups will have incomplete database schema.

### Cause 3: Route Registration Order (RESOLVED)
**Status:** ✅ Already correct
**Verification:** Line 565 has `/pending-receipts` before line 615 has `/:id`

## Design Decisions

### Decision 1: Create Missing POST Routes
**Approach:** Add both `/verify-sender` and `/verify-recipient` POST routes to `backend/routes/transactions.js`
**Rationale:** 
- Frontend already calls these endpoints
- Logic for dual verification already exists in codebase (lines 700-850)
- Need to extract and organize this logic into proper route handlers
- Maintain security: verify sender owns transaction, verify recipient is the correct user

**Implementation Pattern:** Follow existing route structure in transactions.js:
```javascript
router.post('/verify-sender', verifyToken, [validations], async handler)
router.post('/verify-recipient', verifyToken, [validations], async handler)
```

### Decision 2: Update Schema to Match Reality
**Approach:** Add missing columns to `backend/config/schema.sql`
**Rationale:**
- Schema must be source of truth for database structure
- Prevents future setup issues
- Documents the actual dual verification fields
- Includes face_photo column for face_registrations

### Decision 3: Add Comprehensive Debug Logging
**Approach:** Add strategic console.log statements at key points
**Rationale:**
- Track request flow from frontend → backend
- Identify exact failure points
- Log transaction IDs, user IDs, and verification states
- Help debug future issues

**Logging Points:**
1. When `/pending-receipts` is called → log userId, query results count
2. When `/verify-sender` is called → log transactionId, senderId
3. When `/verify-recipient` is called → log transactionId, recipientId
4. When transaction status changes → log old and new states

### Decision 4: Maintain Existing Verification Flow
**Approach:** Keep dual verification as-is: sender verifies first, then recipient
**Rationale:**
- User specifically requested NO changes to dual verification logic
- Frontend already implements this flow correctly
- Just need to wire up missing backend routes

## Implementation Plan

- [ ] 1. **Add missing dual verification columns to schema.sql**
      Update `backend/config/schema.sql` to add the columns that exist in production database but are missing from schema file.
      Add to transactions table: `sender_verified`, `sender_verification_time`, `recipient_verified`, `recipient_verification_time`, `verification_stage`.
      Add to face_registrations table: `face_photo TEXT` column.
      Files: `backend/config/schema.sql`
      Verify: Compare updated schema with actual database columns using `node -e "const db = require('./config/database'); db.query('SHOW COLUMNS FROM transactions').then(([cols]) => console.log(cols.map(c => c.Field))).finally(() => process.exit())"` - all columns should match.

- [ ] 2. **Extract and create POST /verify-sender route**
      Create the `/verify-sender` POST route in `backend/routes/transactions.js` after the `/send` route (~line 170).
      Route accepts: `transactionId`, `faceVerified`, `livenessScore`, `verificationData`.
      Validates: sender is transaction owner, transaction is pending, sender hasn't already verified.
      Updates: `sender_verified=TRUE`, `sender_verification_time=NOW()`, `verification_stage='pending_recipient'`, `liveness_score`.
      Returns: success message with transaction data and `verificationStage='pending_recipient'`.
      Add logging: "Verify sender request:", transactionId, userId.
      Files: `backend/routes/transactions.js` (insert after line 170)
      Verify: Start backend with `npm start`, check server logs show route registration. Use curl or Postman to POST to `http://localhost:3000/api/transactions/verify-sender` with valid JWT and transaction data - should return 200 with success message.

- [ ] 3. **Extract and create POST /verify-recipient route**
      Create the `/verify-recipient` POST route in `backend/routes/transactions.js` after `/verify-sender` route (~line 270).
      Route accepts: `transactionId`, `faceVerified`, `livenessScore`, `verificationData`.
      Validates: recipient is transaction owner, transaction is pending, sender already verified, recipient hasn't verified yet.
      On success: Updates `recipient_verified=TRUE`, `recipient_verification_time=NOW()`, `verification_stage='both_verified'`, `status='completed'`.
      Transfers funds: Updates sender balance (decrease), recipient balance (increase).
      Returns: success message with transaction data and `verificationStage='both_verified'`, `status='completed'`.
      Add logging: "Verify recipient request:", transactionId, userId.
      Files: `backend/routes/transactions.js` (insert after /verify-sender route)
      Verify: Start backend with `npm start`. Use curl or Postman to POST to `http://localhost:3000/api/transactions/verify-recipient` with valid JWT and transaction data after sender verification - should return 200 with success, check database shows `recipient_verified=TRUE`, `status='completed'`, and balances updated.

- [ ] 4. **Add debug logging to /pending-receipts route**
      Add console.log statements to track the request flow in the existing `/pending-receipts` GET route.
      Log: "Fetching pending receipts for userId:", userId at route entry (line ~567).
      Log: "Found X pending receipts" with count after query (line ~586).
      Log: "Pending receipts query result:" with first transaction if available.
      Files: `backend/routes/transactions.js` (lines 565-610)
      Verify: Start backend, log in as recipient user, trigger `/pending-receipts` call from frontend - check console logs show user ID and transaction count.

- [ ] 5. **Add debug logging to frontend API calls**
      Add console.log to track frontend → backend API communication.
      In `frontend/js/config.js` apiCall function (lines 150-180): Log "API Call:", method, url before fetch.
      In `frontend/js/transactions.js` loadPendingReceipts (line 310): Log "Loading pending receipts..." before call.
      In `frontend/js/transactions.js` verifyReceipt (line 387): Log "Verifying receipt:", transactionId, amount, senderName.
      In `frontend/js/face-verification.js` verifyTransactionAsRecipient (line 839): Log "Recipient verification request:", transactionId.
      Files: `frontend/js/config.js`, `frontend/js/transactions.js`, `frontend/js/face-verification.js`
      Verify: Open browser console, navigate to transactions page as recipient - should see logs showing API calls with URLs and transaction IDs.

- [ ] 6. **Verify face_registrations.face_photo column exists**
      Check if the face_registrations table has the face_photo column that the code expects.
      If missing, add it: `ALTER TABLE face_registrations ADD COLUMN face_photo TEXT AFTER face_encoding`.
      This column is queried at line ~745 in transactions.js for sender verification.
      Files: May require manual SQL or migration script
      Verify: Run query `node -e "const db = require('./config/database'); db.query('SHOW COLUMNS FROM face_registrations').then(([cols]) => console.log(cols.map(c => c.Field))).finally(() => process.exit())"` and confirm `face_photo` is in the list.

- [ ] 7. **Test complete dual verification flow end-to-end**
      Test the full flow: sender creates transaction → sender verifies → recipient sees pending → recipient verifies → payment completes.
      Setup: Two test users (Alice as sender, Bob as recipient) with registered faces and sufficient balance.
      Step 1: Alice logs in, sends money to Bob, verifies face (should call /verify-sender).
      Step 2: Bob logs in, checks "Pending Receipts" (should call /pending-receipts and show transaction).
      Step 3: Bob clicks "Verify Now", completes face verification (should call /verify-recipient).
      Step 4: Check database - transaction should have `sender_verified=TRUE`, `recipient_verified=TRUE`, `status='completed'`.
      Step 5: Check balances - Alice balance decreased, Bob balance increased by transaction amount.
      Files: All modified files
      Verify: Complete end-to-end test succeeds with no 404 errors in browser console, both users see correct balances, transaction history shows completed transaction with both verifications.

- [ ] 8. **Update server startup logging**
      Add the new routes to the server startup banner in `backend/server.js`.
      Add to endpoints list (line ~75): `• POST /api/transactions/verify-sender` and `• POST /api/transactions/verify-recipient`.
      Files: `backend/server.js`
      Verify: Restart backend server - startup banner should list both new verification endpoints.

## Verification Strategy

**Per-Step Verification:**
Each step includes specific verification commands or procedures listed above.

**Final Integration Test:**
After all steps complete:
1. Restart backend server: `cd backend && npm start`
2. Open frontend in browser (Live Server)
3. Create two test accounts (if not exist)
4. Register faces for both users
5. Alice (sender): Send ₹100 to Bob → Verify face → Should succeed
6. Bob (recipient): Check Pending Receipts → Should see ₹100 from Alice → Click Verify Now → Verify face → Should receive payment
7. Check browser console: Should show NO 404 errors
8. Check backend logs: Should show all verification requests
9. Check database: `SELECT transaction_id, sender_verified, recipient_verified, verification_stage, status FROM transactions ORDER BY id DESC LIMIT 1;` → Should show both TRUE, 'both_verified', 'completed'

**Success Criteria:**
- ✅ No 404 errors in browser console
- ✅ `/pending-receipts` returns recipient's pending transactions
- ✅ Sender can verify (Phase 1) via `/verify-sender`
- ✅ Recipient can verify (Phase 2) via `/verify-recipient`
- ✅ Transaction completes and balances update correctly
- ✅ All debug logs show request flow
- ✅ Fresh database setup from schema.sql works

## Security Considerations Preserved

1. **Authentication:** All routes use `verifyToken` middleware
2. **Authorization:** 
   - Sender can only verify their own sent transactions
   - Recipient can only verify transactions sent to them
   - `/pending-receipts` only shows current user's pending receipts
3. **Transaction State:** Validate transaction is still pending before verification
4. **Idempotency:** Prevent double verification (check sender_verified/recipient_verified flags)
5. **Balance Protection:** Only transfer funds after both verifications complete

## Notes

- **NO schema changes to existing columns** - only adding missing columns to schema.sql to document what's already in production
- **NO changes to dual verification logic** - preserving the sender-first, then-recipient flow
- **NO changes to face verification process** - keeping existing liveness checks and thresholds
- **Transaction ID format** - continuing to use TX... format (e.g., TX17354829120001)
- The routes being added already have logic scattered in the codebase - this plan consolidates and properly exposes them

## Risk Assessment

**Low Risk:**
- Adding routes follows existing patterns in transactions.js
- Schema update only documents existing reality
- Debug logging is non-invasive

**Medium Risk:**
- Ensure fund transfer logic is atomic (use database transactions if not already)
- Verify face_photo column exists before deployment

**Mitigation:**
- Test with small amounts first
- Verify database state after each verification step
- Keep transaction logs for audit trail
