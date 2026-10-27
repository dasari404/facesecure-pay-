# Implementation Plan: Username-Based Recipient Lookup for FaceSecure Pay

## Codebase Analysis Summary

**Project Type:** Node.js/Express REST API backend + Vanilla JavaScript frontend  
**Database:** MySQL 5.7+ with mysql2/promise  
**Authentication:** JWT with bcryptjs password hashing  
**Test Framework:** Manual testing with `npm test` (runs test-api.js)  
**Build Command:** N/A (no build step, direct Node.js execution)  
**Start Command:** `npm start` or `npm run dev` (nodemon for development)  
**Setup Command:** `npm run setup` (runs setup-database.js to create tables)

**Current State:**
- ✅ Users table exists WITHOUT username column
- ✅ Registration endpoint accepts: email, password, full_name, phone (optional)
- ✅ Search endpoint `/api/auth/search` searches ONLY by exact email match
- ✅ Transaction send endpoint uses `recipientEmail` parameter
- ✅ Frontend config expects `/api/user/search` but backend defines `/api/auth/search` (routing mismatch already handled by server.js mounting auth.js at both `/api/auth` and `/api/user`)
- ✅ Frontend registration form has fields: full_name, email, phone, password
- ✅ Transaction form has recipient search with real-time validation

## Implementation Plan

### Phase 1: Database Schema Migration

- [ ] 1. Create database migration script to add username column safely to users table.
      **What:** Add `username VARCHAR(50) UNIQUE` column to users table with index. For existing users without usernames, generate temporary usernames from email (e.g., "user_" + id) to maintain uniqueness. Add constraint that allows NULL initially for backward compatibility during migration, then update all NULLs, then make NOT NULL.
      **Files:** 
      - Create `backend/migrations/001_add_username_column.js`
      - Update `backend/config/schema.sql` (lines 31-48, users table definition)
      **Verify:** Run migration script with test database credentials. Query `DESCRIBE users;` to confirm username column exists with UNIQUE constraint. Check that existing test users have generated usernames.
      **Migration Safety:** Script checks if column exists before adding. Uses transactions with rollback on error. Generates unique usernames for existing users before enforcing NOT NULL constraint.
      **Rollback:** Script includes a `rollback()` function that drops the username column if needed: `ALTER TABLE users DROP COLUMN username;`

### Phase 2: Backend Registration Enhancement

- [ ] 2. Update registration endpoint to accept and validate username parameter.
      **What:** Modify POST `/api/auth/register` in `backend/routes/auth.js` (lines 10-73) to:
      - Add express-validator rule: `body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/)` (alphanumeric + underscore only)
      - Normalize username to lowercase for case-insensitive storage
      - Check username uniqueness with query: `SELECT id FROM users WHERE LOWER(username) = LOWER(?)`
      - Return error "Username already taken" if exists
      - Include username in INSERT statement: `INSERT INTO users (email, password_hash, full_name, phone, username, balance) VALUES (?, ?, ?, ?, ?, 1000.00)`
      - Include username in JWT payload and response user object
      **Files:** `backend/routes/auth.js` (lines 10-73)
      **Verify:** POST to `/api/auth/register` with username "alice123". Confirm response includes username. Attempt duplicate username, confirm 400 error. Query database: `SELECT username FROM users WHERE email = 'alice@example.com';` to verify storage.

- [ ] 3. Update login endpoint to return username in user object.
      **What:** Modify POST `/api/auth/login` in `backend/routes/auth.js` (lines 75-137) to include username in the response user object (line 128-135). Add username to JWT token payload for consistency.
      **Files:** `backend/routes/auth.js` (lines 122-135)
      **Verify:** POST to `/api/auth/login`, confirm response JSON includes `user.username` field.

- [ ] 4. Update profile endpoint to return username.
      **What:** Modify GET `/api/user/profile` in `backend/routes/auth.js` (lines 139-177) to include username in SELECT query (line 143) and response object (lines 153-163).
      **Files:** `backend/routes/auth.js` (lines 143, 153-163)
      **Verify:** GET `/api/user/profile` with valid token, confirm username in response.

### Phase 3: Enhanced Recipient Search

- [ ] 5. Rewrite user search endpoint to support multi-field lookup.
      **What:** Replace GET `/api/auth/search` implementation in `backend/routes/auth.js` (lines 179-208) with new logic:
      - Accept `query` parameter (min 3 chars)
      - Normalize query: trim whitespace, convert to lowercase
      - Build SQL with OR conditions checking: username (LOWER), email (LOWER), phone (normalized - remove spaces/dashes), and user id (exact int match if query is numeric)
      - SQL: `SELECT id, username, full_name, email, phone FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR REPLACE(REPLACE(phone, ' ', ''), '-', '') = ? OR id = ?) AND id != ? AND account_status = 'active'`
      - Limit results to 10 matches to prevent abuse
      - Return array with fields: id, username, full_name, email (mask to first 3 chars + ***@domain for privacy)
      **Files:** `backend/routes/auth.js` (lines 179-208)
      **Verify:** 
      - Search "alice123" → returns Alice's account
      - Search "alice@example.com" → returns Alice's account
      - Search Alice's phone → returns Alice's account
      - Search Alice's user ID → returns Alice's account
      - Search "self" when logged in as Alice → excludes Alice from results
      - Search "invalid999" → returns empty array

### Phase 4: Transaction Processing Update

- [ ] 6. Update transaction send endpoint to accept flexible recipient identifier.
      **What:** Modify POST `/api/transactions/send` in `backend/routes/transactions.js` (lines 14-96) to:
      - Replace `recipientEmail` parameter with `recipientIdentifier`
      - Update validator: `body('recipientIdentifier').trim().isLength({ min: 1 })` (less restrictive than email-only)
      - Add recipient resolution logic before line 40: query users table with same multi-field OR logic as search endpoint
      - If no match found, return 404 "Recipient not found. Please use username, email, phone, or user ID."
      - If multiple matches (shouldn't happen with unique constraints), return 400 "Multiple recipients found. Please be more specific."
      - Continue existing flow with resolved recipient.id
      - Store both recipient_id and original recipientIdentifier in transaction record for audit trail (schema already has recipient_email field, can reuse for identifier)
      **Files:** `backend/routes/transactions.js` (lines 14-96)
      **Design Decision:** Reuse existing `recipient_email` column to store the identifier string the user entered, since it's VARCHAR(100) and serves as audit trail. The actual recipient is resolved via `recipient_id` foreign key.
      **Verify:** 
      - Send ₹20 from Alice to "bob456" → transaction created with Bob as recipient
      - Send ₹20 from Alice to "bob@example.com" → transaction created
      - Send ₹20 from Alice to Bob's phone → transaction created
      - Send ₹20 from Alice to Bob's user ID → transaction created
      - Send ₹20 from Alice to "alice123" → 400 error "Cannot send money to yourself"
      - Send ₹20 from Alice to "nonexistent" → 404 error

### Phase 5: Frontend Registration Form

- [ ] 7. Add username input field to registration form.
      **What:** Update `frontend/register.html` (after line 39, before email field):
      - Add form group with label "Username", input id="username", name="username", placeholder="Choose a unique username (letters, numbers, _ only)", required, minlength="3", maxlength="50", pattern="[a-zA-Z0-9_]+"
      - Add form hint: "3-50 characters, letters, numbers, and underscores only"
      - Update inline script (lines 83-140) to include username validation
      - Add real-time username format validation: check pattern /^[a-zA-Z0-9_]{3,50}$/
      **Files:** `frontend/register.html` (lines 27-82, inline script lines 83-140)
      **Verify:** Open register.html in browser. Confirm username field appears between name and email. Try submitting with invalid username (e.g., "ab", "user name", "user@123") and confirm HTML5 validation blocks it.

- [ ] 8. Update registration JavaScript to send username to API.
      **What:** Modify `register()` function in `frontend/js/auth.js` (lines 1-30) to:
      - Accept username parameter: `async function register(email, password, fullName, phone, username)`
      - Include username in request body: `body: { email, password, full_name: fullName, phone, username }`
      - Store username in localStorage if registration succeeds: `localStorage.setItem('facepay_user', JSON.stringify(response.user))`
      - Update inline registration form handler in register.html (line 102) to pass username: `await register(email, password, fullName, phone, username);`
      **Files:** `frontend/js/auth.js` (lines 1-30), `frontend/register.html` (inline script around line 102)
      **Verify:** Register new user "charlie" with username "charlie789". Check Network tab for POST request body containing username. Confirm successful registration and redirect to login.

### Phase 6: Frontend Transaction Form Enhancement

- [ ] 9. Update transaction form label and search logic for multi-field lookup.
      **What:** Modify `frontend/transactions.html` and `frontend/js/transactions.js`:
      - Update label in transactions.html (line 55): "Recipient (username, email, phone, or ID)"
      - Update placeholder (line 59): "Enter recipient's username, email, phone, or user ID"
      - Update hint (line 63): "Search by any identifier"
      - searchRecipient() function in transactions.js already debounces and calls `/api/user/search?query=`, so no changes needed to search logic
      - Update recipient display (line 94-104 in transactions.js) to show username prominently: `<h4>${user.username} (${user.full_name})</h4>`
      **Files:** `frontend/transactions.html` (lines 55-63), `frontend/js/transactions.js` (lines 94-104)
      **Verify:** Open transactions page. Confirm label shows new text. Type "bob456" in recipient field, confirm real-time search displays Bob's name with username shown prominently.

- [ ] 10. Update send money API call to use recipientIdentifier.
      **What:** Modify `handleSendMoneySubmit()` function in `frontend/js/transactions.js` (lines 122-163):
      - Change variable name from `recipientEmail` to `recipientIdentifier` (line 125)
      - Update API request body (lines 145-150): `body: { recipientIdentifier, amount, description, transactionType }`
      - Error messages already generic, no changes needed
      **Files:** `frontend/js/transactions.js` (lines 125, 145-150)
      **Verify:** Enter "bob456" as recipient, ₹20 amount, submit form. Check Network tab POST request to `/api/transactions/send` contains `recipientIdentifier: "bob456"`. Confirm transaction proceeds to verification.

### Phase 7: Frontend Config Update

- [ ] 11. Verify API endpoint configuration consistency.
      **What:** Review `frontend/js/config.js` (lines 12-15). Current config has `SEARCH_USER: ${CONFIG.API_BASE_URL}/user/search` which maps to backend route because server.js (line 56) mounts auth.js at both `/api/auth` and `/api/user`. No changes required, but add comment for clarity.
      **Files:** `frontend/js/config.js` (line 14)
      **Verify:** Inspect `backend/server.js` lines 54-56. Confirm both routes mounted. Add comment in config.js: `// Mapped to /api/auth/search endpoint (server.js mounts auth routes at both /api/auth and /api/user)`

### Phase 8: Testing with Two Users

- [ ] 12. Create comprehensive test script for username-based transactions.
      **What:** Create `backend/test-username-flow.js` that:
      - Registers Alice with username "alice123", email "alice@test.com"
      - Registers Bob with username "bob456", email "bob@test.com"  
      - Tests Alice searching for Bob by username, email, phone, and ID (4 separate API calls)
      - Tests Alice creating transaction to Bob using username "bob456"
      - Verifies transaction record has correct recipient_id and recipientIdentifier
      - Tests self-transfer prevention (Alice tries to send to "alice123")
      - Tests invalid recipient (Alice tries to send to "nobody999")
      - Prints color-coded pass/fail for each test case
      **Files:** Create `backend/test-username-flow.js`
      **Verify:** Run `node backend/test-username-flow.js`. All 8 test cases should pass:
      1. ✅ Alice registration with username
      2. ✅ Bob registration with username  
      3. ✅ Search by username finds Bob
      4. ✅ Search by email finds Bob
      5. ✅ Search by phone finds Bob
      6. ✅ Search by ID finds Bob
      7. ✅ Transaction created with username identifier
      8. ✅ Self-transfer blocked
      9. ✅ Invalid recipient returns 404

### Phase 9: Manual UI Testing

- [ ] 13. Perform end-to-end UI testing with browser.
      **What:** Manual testing workflow:
      1. Start backend: `cd backend && npm start`
      2. Open `frontend/register.html` with Live Server (port 5500)
      3. Register Alice with username "alice123", email "alice@example.com", password "password123"
      4. Register Bob with username "bob456", email "bob@example.com", password "password456"
      5. Login as Alice, navigate to transactions page
      6. Test recipient search: type "bob456" → verify Bob appears
      7. Enter amount ₹20, description "Test payment", submit
      8. Complete fraud check and face verification (mock flow)
      9. Verify balances: Alice ₹980, Bob ₹1020
      10. Check transaction history shows "Sent to bob456"
      11. Login as Bob, check transaction history shows "Received from alice123"
      **Files:** None (manual testing)
      **Verify:** All steps complete without errors. Screenshot final balances and transaction history for documentation.

### Phase 10: Documentation Update

- [ ] 14. Update API documentation and implementation notes.
      **What:** Update `IMPLEMENTATION-COMPLETE.md`:
      - Add section "Phase 5: Username-Based Recipient Lookup ✅"
      - Document new registration parameter: username (required, 3-50 chars, alphanumeric + underscore)
      - Document enhanced search endpoint behavior (multi-field OR search)
      - Document transaction send parameter change (recipientIdentifier vs recipientEmail)
      - Update test user examples to include usernames
      - Add troubleshooting section for username conflicts
      **Files:** `IMPLEMENTATION-COMPLETE.md`
      **Verify:** Review document for accuracy and completeness.

## Rollback Strategy

If issues occur during any phase:

**Phase 1 (Database):** Run migration rollback function: `node backend/migrations/001_add_username_column.js --rollback` which executes `ALTER TABLE users DROP COLUMN username;`. Then restore from MySQL backup if available: `mysql -u root -p nada < backup.sql`

**Phase 2-4 (Backend):** Use git to revert changes: `git checkout backend/routes/auth.js backend/routes/transactions.js`. Restart server.

**Phase 5-7 (Frontend):** Clear browser cache and hard reload. If persistent issues, revert files with git: `git checkout frontend/`

**Phase 8-10 (Testing/Docs):** No rollback needed (non-production changes).

**Database Backup Command (run BEFORE Phase 1):**  
```bash
mysqldump -u root -p nada > backup_before_username_migration.sql
```

## Testing Approach

**Two Test Users:**
- **Alice:** username "alice123", email "alice@example.com", phone "+1234567890", initial balance ₹1000
- **Bob:** username "bob456", email "bob@example.com", phone "+0987654321", initial balance ₹1000

**Test Scenarios:**
1. Alice searches for Bob by username "bob456" → finds Bob
2. Alice searches for Bob by email "bob@example.com" → finds Bob  
3. Alice searches for Bob by phone "+0987654321" → finds Bob
4. Alice searches for Bob by user ID (e.g., "2") → finds Bob
5. Alice sends ₹20 to "bob456" → transaction succeeds, balances update
6. Alice attempts to send to "alice123" → blocked with error
7. Alice attempts to send to "nobody" → 404 error
8. Bob searches for Alice by any identifier → finds Alice

**Verification Points:**
- All searches return correct user within 500ms (debounce delay)
- Transaction creation returns transactionId
- Fraud check passes (score 0 for first transaction between new users)
- Face verification mock passes (liveness score 85)
- Final balances: Alice ₹980, Bob ₹1020
- Transaction history shows correct sender/recipient usernames

## Key Design Decisions

**Decision 1:** Store username in lowercase for case-insensitive uniqueness  
**Rationale:** Prevents "Alice123" and "alice123" being registered as different users, matches common username systems (Twitter, Instagram, GitHub)

**Decision 2:** Reuse `recipient_email` column for recipientIdentifier audit trail  
**Rationale:** Avoids schema change to transactions table. Column is VARCHAR(100) and already stores string identifier. Actual recipient is resolved via `recipient_id` FK, so column name is legacy.

**Decision 3:** Username pattern: alphanumeric + underscore only, 3-50 chars  
**Rationale:** Simple, unambiguous, prevents injection attacks, matches industry standards (alphanumeric + underscore is Twitter/Instagram standard)

**Decision 4:** Generate temporary usernames for existing users during migration  
**Rationale:** Maintains data integrity without requiring manual intervention. Format "user_{id}" ensures uniqueness. Users can change via profile settings in future feature.

**Decision 5:** Multi-field OR search instead of separate endpoints  
**Rationale:** Single endpoint simplifies frontend logic. Backend determines best match. Performance acceptable with indexed columns (email, phone already indexed in schema).

**Decision 6:** Mask email in search results (first 3 chars + ***@domain)  
**Rationale:** Privacy protection. User can confirm recipient without exposing full email. Username provides primary identification.

## Success Criteria

✅ Database migration completes without errors  
✅ Existing users get generated usernames without data loss  
✅ New users can register with custom usernames  
✅ Username uniqueness enforced (case-insensitive)  
✅ Search by username returns correct user  
✅ Search by email returns correct user  
✅ Search by phone returns correct user  
✅ Search by user ID returns correct user  
✅ Transaction created with username identifier  
✅ Transaction blocked when sending to self  
✅ Transaction fails gracefully for invalid recipient  
✅ Balances update correctly after verified transaction  
✅ Transaction history displays usernames  
✅ All existing functionality remains working (login, admin, reports)  
✅ No security regressions (SQL injection, XSS protected)  

## Estimated Implementation Time

- Phase 1 (Database): 45 minutes
- Phase 2 (Registration): 30 minutes  
- Phase 3 (Search): 45 minutes
- Phase 4 (Transactions): 60 minutes
- Phase 5 (Frontend Form): 30 minutes
- Phase 6 (Frontend Transaction): 30 minutes
- Phase 7 (Config): 15 minutes
- Phase 8 (Testing Script): 45 minutes
- Phase 9 (Manual Testing): 30 minutes
- Phase 10 (Documentation): 30 minutes

**Total: ~6 hours** (single developer, includes testing)

## Dependencies

All required dependencies already installed in `backend/package.json`:
- express-validator: ^7.0.1 (for username validation)
- mysql2: ^3.6.0 (for database operations)
- bcryptjs: ^2.4.3 (for password hashing)
- jsonwebtoken: ^9.0.2 (for JWT tokens)

No new npm packages required.
