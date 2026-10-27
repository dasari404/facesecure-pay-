# FaceSecure Pay - Transaction System Implementation Plan

## Project Context

**Project Type:** Express.js REST API backend + vanilla JavaScript frontend  
**Database:** MySQL with mysql2/promise connection pool  
**Authentication:** JWT with bcryptjs password hashing  
**Current State:** Admin panel and reports system working, transaction page UI exists but not connected

### Existing Infrastructure
- ✅ Database schema complete (schema.sql) with users, transactions, face_registrations tables
- ✅ JWT middleware (`backend/middleware/auth.js`) with verifyToken, verifyAdmin, optionalAuth
- ✅ Admin routes working (`backend/routes/admin.js`) - pattern to follow
- ✅ Reports routes working (`backend/routes/reports.js`) - pattern to follow
- ✅ Frontend structure exists with placeholder JS files
- ✅ Transaction page UI complete (`frontend/transactions.html`)
- ⚠️ No .env file - using defaults from code (port 3000, localhost MySQL)

### Build & Test Commands
- **Start backend:** `cd backend && npm start` (production) or `npm run dev` (development with nodemon)
- **Database setup:** `cd backend && npm run setup` (runs setup-database.js if it exists)
- **Test API:** `cd backend && npm run test` (runs test-api.js if it exists)
- **Frontend:** Open HTML files via Live Server on port 5500 (CORS configured for http://127.0.0.1:5500)

### Key Patterns Found
1. **Route structure:** Express router with async/await, db.query() for MySQL, validation with express-validator
2. **Error handling:** try-catch blocks returning {success: boolean, message: string, ...data}
3. **Authentication:** JWT in Authorization header as "Bearer TOKEN", decoded to req.user
4. **Database queries:** Using mysql2/promise pool with prepared statements
5. **Frontend API calls:** apiCall() helper in config.js handles token injection and error handling
6. **Password hashing:** bcryptjs with compare() for verification

---

## Implementation Plan

### Phase 1: User Authentication System

- [ ] 1. Create backend authentication routes file `backend/routes/auth.js`
      Implement POST /api/auth/register (email, password, full_name, phone validation with express-validator, bcrypt hash password, insert user with balance 1000.00, generate JWT, return user data + token).
      Implement POST /api/auth/login (validate credentials, bcrypt compare, update last_login, generate JWT, return user data + token).
      Implement GET /api/user/profile (protected with verifyToken middleware, query user by req.user.id, return user details excluding password_hash).
      Implement GET /api/user/search (protected, query param ?query=email, search users by email, return only id, full_name, email).
      Files: backend/routes/auth.js
      Verify: Start backend with `npm start`, use curl or Postman to POST /api/auth/register with test user data, confirm 201 response with token, then POST /api/auth/login with same credentials, confirm 200 response with token.

- [ ] 2. Register auth routes in server.js
      Add `app.use('/api/auth', require('./routes/auth'));` and `app.use('/api/user', require('./routes/auth'));` after existing route registrations.
      Update the endpoint list in the startup banner to include new auth endpoints.
      Files: backend/server.js
      Verify: Restart backend, check startup banner shows new endpoints, test GET /api/user/profile with Authorization header containing valid JWT from login response.

- [ ] 3. Create frontend login page `frontend/login.html`
      Full HTML page with email and password form, link to register page, "Remember me" checkbox, forgot password link (placeholder).
      Use existing styles from main.css and auth.css for consistent look matching index.html and admin-login.html patterns.
      Include script tags for config.js, utils.js, auth.js.
      Files: frontend/login.html
      Verify: Open login.html in browser, check form displays correctly with all styling, check browser console for no JS errors.

- [ ] 4. Create frontend register page `frontend/register.html`
      Full HTML page with registration form (email, password, confirm password, full name, phone), link to login page.
      Client-side validation for email format, password strength (min 8 chars), password match, phone format.
      Use existing styles matching the project's design system.
      Include script tags for config.js, utils.js, auth.js.
      Files: frontend/register.html
      Verify: Open register.html in browser, test form validation by submitting with invalid data (mismatched passwords, invalid email), confirm validation messages appear.

- [ ] 5. Implement auth.js frontend functions
      Replace placeholder with register(email, password, fullName, phone) calling API.REGISTER via apiCall, storing token as 'facepay_token' in localStorage.
      Implement login(email, password) calling API.LOGIN, storing token and user data in localStorage.
      Implement logout() clearing localStorage and redirecting to index.html.
      Implement checkAuth() checking for token and redirecting to login if missing.
      Update API endpoints in config.js: REGISTER='/api/auth/register', LOGIN='/api/auth/login', GET_USER='/api/user/profile', SEARCH_USER='/api/user/search'.
      Files: frontend/js/auth.js, frontend/js/config.js
      Verify: Open register.html, fill form with test data, submit, check browser console Network tab for successful POST to /api/auth/register, check localStorage for 'facepay_token', confirm redirect to transactions.html works.

- [ ] 6. Connect login and register pages to backend
      Add event listeners on DOMContentLoaded in login.html and register.html to handle form submissions.
      Show loading states on submit buttons during API calls.
      Display error messages from API responses in alert divs.
      On successful login/register, redirect to transactions.html.
      Files: frontend/login.html, frontend/register.html
      Verify: Complete end-to-end test: register new user, see redirect to transactions.html, logout, login again with same credentials, confirm redirect to transactions.html and no errors in console.

---

### Phase 2: Transaction Processing Backend

- [ ] 7. Create transaction routes file `backend/routes/transactions.js`
      Implement POST /api/transactions/send (protected with verifyToken) accepting {recipientEmail, amount, description, transactionType}, validate recipient exists in users table, check sender balance >= amount, generate unique transaction_id (format: TX + timestamp + random), insert transaction with status 'pending', return {success, transactionId, amount, recipient: {name, email}, requiresVerification: true}.
      Implement GET /api/transactions (protected) with query params ?type=sent|received|all&limit=20&page=1&status=pending|completed|failed, join with users table for recipient/sender names, return paginated transaction list with metadata.
      Implement GET /api/transactions/:id (protected) returning single transaction details with full sender/recipient info.
      Files: backend/routes/transactions.js
      Verify: Start backend, use Postman with Authorization header containing valid user JWT, POST /api/transactions/send with test recipient email (create second test user first), confirm transaction created with status 'pending', GET /api/transactions to see it listed.

- [ ] 8. Create fraud detection module `backend/services/fraudDetection.js`
      Export async function checkFraud(userId, recipientEmail, amount) that queries user balance and recent transaction count (last hour), calculates fraud score: +30 if amount > balance*0.5, +25 if >5 transactions in 1 hour, +15 if never sent to recipient before, +10 if hour is 2-5 AM, +20 if amount > 10000.
      Return {fraudScore, riskLevel: 'LOW_RISK'|'MEDIUM_RISK'|'HIGH_RISK', shouldBlock: fraudScore >= 70, details: {...}}.
      Files: backend/services/fraudDetection.js
      Verify: Create unit test file or manual test in node REPL: require the module, call checkFraud with test data, confirm fraud score calculation is correct for various scenarios (high amount, frequent transactions, etc).

- [ ] 9. Add fraud check endpoint `POST /api/fraud/check` in transactions.js
      Protected route accepting {transactionId}, load transaction from database, call fraudDetection.checkFraud(), update transaction with fraud_score and fraud_check_result, return fraud analysis.
      If fraud score >= 70, set transaction status to 'cancelled' and fraud_check_passed to false.
      Files: backend/routes/transactions.js
      Verify: Create a transaction, call POST /api/fraud/check with its ID, confirm fraud score is calculated and stored, query database directly to verify fraud_score column updated.

- [ ] 10. Add transaction verification endpoint `POST /api/transactions/verify` in transactions.js
      Protected route accepting {transactionId, faceVerified, livenessScore, verificationData}.
      Load transaction, verify it belongs to req.user.id (sender) and status is 'pending'.
      If faceVerified is true and livenessScore >= 60: start MySQL transaction, deduct amount from sender balance, add amount to recipient balance (lookup by recipient_email), update transaction status to 'completed', set face_verified and liveness_verified, record completed_at timestamp, commit transaction.
      If verification fails: set transaction status to 'failed', rollback any balance changes.
      Return {success, transaction: {...updated transaction}}.
      Files: backend/routes/transactions.js
      Verify: Create pending transaction, call POST /api/transactions/verify with faceVerified: true and livenessScore: 85, query users table to confirm both sender and recipient balances updated correctly, query transactions table to confirm status is 'completed'.

- [ ] 11. Register transaction routes in server.js
      Add `app.use('/api/transactions', require('./routes/transactions'));` and `app.use('/api/fraud', require('./routes/transactions'));` after auth routes.
      Update startup banner with new transaction endpoints.
      Files: backend/server.js
      Verify: Restart backend, check startup banner, test full transaction flow: create transaction, run fraud check, verify with face data, confirm transaction completes and balances update.

---

### Phase 3: Transaction Frontend Integration

- [ ] 12. Implement transactions.js frontend logic
      Add loadUserProfile() calling API.GET_USER to fetch and display user name, email, balance in sidebar.
      Add loadTransactionHistory() calling API.TRANSACTIONS with pagination, rendering transaction items with appropriate icons (sent/received), amounts (red/green), and status badges.
      Add handleSendMoneySubmit(event) preventing default, collecting form data, calling apiCall(API.SEND_MONEY, {method: 'POST', body: formData}), on success showing verification section and storing transactionId globally.
      Add recipientSearch using debounced input listener calling API.SEARCH_USER, displaying found recipient in recipient-found div.
      Files: frontend/js/transactions.js
      Verify: Open transactions.html after login, check user profile loads in sidebar with correct balance, check any existing transactions load in history section, try searching for recipient and confirm found indicator appears.

- [ ] 13. Add authentication guard to transactions.html
      Add script at page load checking localStorage for 'facepay_token', if missing redirect to login.html.
      Call loadUserProfile() and loadTransactionHistory() on DOMContentLoaded.
      Wire up send-money-form submit event to handleSendMoneySubmit.
      Files: frontend/transactions.html
      Verify: Open transactions.html directly without login, confirm redirect to login.html, then login and navigate to transactions.html, confirm page loads with user data.

- [ ] 14. Implement face verification UI flow in face-verification.js
      Replace placeholder with async startVerification() that: shows camera-view, calls navigator.mediaDevices.getUserMedia({video: {width: 640, height: 480, facingMode: 'user'}}), assigns stream to camera-video element.
      Add captureFrame() drawing video to canvas and returning canvas.toDataURL('image/jpeg').
      Add updateStep(stepName, status) updating verification-step elements with 'active' or 'complete' classes.
      Add runLivenessTest() showing random challenges from LIVENESS_CHALLENGES, capturing frames, returning mock {livenessScore: 85, passed: true} (real liveness detection will be Phase 4).
      Add verifyTransaction(transactionId, faceImage, livenessData) calling API.TRANSACTIONS_VERIFY with data, returning result.
      Files: frontend/js/face-verification.js
      Verify: In transactions.html, submit send money form to reach verification section, click start verification button, confirm camera activates and video displays in camera-view element, confirm verification steps update to active/complete states.

- [ ] 15. Connect verification flow to transaction completion
      In face-verification.js, implement full verification sequence: updateStep('fraud', 'active'), call fraud check API, updateStep('fraud', 'complete'), updateStep('liveness', 'active'), run liveness test, updateStep('liveness', 'complete'), updateStep('face', 'active'), capture frame and call verify API, updateStep('face', 'complete'), updateStep('complete', 'complete').
      On success: hide verification section, show success message, reload transaction history, reset form.
      On failure: show error message with specific reason, allow retry or cancel.
      Files: frontend/js/face-verification.js, frontend/js/transactions.js
      Verify: Complete full transaction flow: login, enter recipient and amount, submit form, run verification (with mock face data), confirm transaction completes successfully, confirm balances update in UI, confirm transaction appears in history with 'completed' status.

---

### Phase 4: Face Recognition Backend (Future Enhancement)

- [ ] 16. Create Python Flask face API (OPTIONAL - can be implemented later)
      Create python-face-api/app.py with Flask, flask-cors, mediapipe, opencv-python dependencies.
      Implement POST /api/liveness/check accepting base64 image, decoding to numpy array, running MediaPipe face mesh detection, calculating liveness score based on eye aspect ratio, head pose, texture analysis, returning {success, livenessScore, isLive}.
      Implement POST /api/face/register accepting base64 image, extracting face encoding, returning {success, encoding}.
      Implement POST /api/face/compare accepting two face encodings, calculating cosine similarity, returning {success, similarity, match: similarity > 0.8}.
      Start Flask server on port 5000.
      Files: python-face-api/app.py, python-face-api/requirements.txt
      Verify: Start Flask server with `python app.py`, use curl to POST base64-encoded face image to /api/liveness/check, confirm returns liveness score.

- [ ] 17. Create face routes in backend `backend/routes/face.js`
      Implement POST /api/face/register (protected) accepting {faceImage: base64}, calling Python API /api/face/register to get encoding, storing encoding in face_registrations table for req.user.id, setting user.face_registered = true, returning success.
      Implement POST /api/face/liveness (protected) accepting {faceImage: base64}, calling Python API /api/liveness/check, returning liveness result.
      Implement POST /api/face/match (protected) accepting {faceImage: base64}, loading registered face encoding from face_registrations where user_id = req.user.id, calling Python API /api/face/compare, returning match result.
      Files: backend/routes/face.js
      Verify: Register face for test user via POST /api/face/register with valid face image, query face_registrations table to confirm encoding stored, then call POST /api/face/match with different image and verify similarity score returned.

- [ ] 18. Integrate real face verification into transaction flow
      Update POST /api/transactions/verify in transactions.js to accept faceImage base64 data.
      Before completing transaction: call face match API, verify similarity > 80%, call liveness check API, verify liveness score > 60.
      Only complete transaction if both face match and liveness pass.
      Store verification metrics (similarity score, liveness score, verification time) in transaction record.
      Files: backend/routes/transactions.js
      Verify: Complete transaction with real face verification: capture face image, send to verification endpoint, confirm transaction only completes if face matches registered face and liveness passes, confirm metrics stored in database.

---

## Current File Structure

```
facesecure-pay/
├── backend/
│   ├── config/
│   │   ├── database.js          ✅ EXISTS - MySQL pool
│   │   └── schema.sql            ✅ EXISTS - Complete schema
│   ├── middleware/
│   │   └── auth.js               ✅ EXISTS - JWT verification
│   ├── routes/
│   │   ├── admin.js              ✅ EXISTS - Working admin routes
│   │   ├── reports.js            ✅ EXISTS - Working reports routes
│   │   ├── auth.js               ❌ CREATE - User authentication
│   │   ├── transactions.js       ❌ CREATE - Transaction processing
│   │   └── face.js               ❌ CREATE - Face verification (Phase 4)
│   ├── services/
│   │   └── fraudDetection.js     ❌ CREATE - Fraud scoring logic
│   ├── package.json              ✅ EXISTS
│   └── server.js                 ✅ EXISTS - Needs route registration
│
├── frontend/
│   ├── js/
│   │   ├── config.js             ✅ EXISTS - Needs API endpoint updates
│   │   ├── utils.js              ✅ EXISTS - Ready to use
│   │   ├── auth.js               ⚠️  EXISTS - Placeholder, needs implementation
│   │   ├── transactions.js       ⚠️  EXISTS - Placeholder, needs implementation
│   │   └── face-verification.js  ⚠️  EXISTS - Placeholder, needs implementation
│   ├── styles/
│   │   ├── main.css              ✅ EXISTS
│   │   ├── auth.css              ✅ EXISTS
│   │   └── admin.css             ✅ EXISTS
│   ├── index.html                ✅ EXISTS - Landing page
│   ├── admin-login.html          ✅ EXISTS - Admin auth
│   ├── admin.html                ✅ EXISTS - Admin dashboard
│   ├── transactions.html         ✅ EXISTS - Needs JS connection
│   ├── login.html                ❌ CREATE - User login page
│   └── register.html             ❌ CREATE - User registration page
│
└── python-face-api/              ❌ CREATE - Optional Phase 4
    ├── app.py                    ❌ CREATE - Flask face API
    └── requirements.txt          ❌ CREATE - Python dependencies
```

---

## Testing Strategy

### Unit Testing (Manual verification at each step)
- Each backend endpoint tested with curl/Postman before moving to next step
- Database queries verified by direct MySQL queries after API calls
- Frontend functions tested in browser console before UI integration

### Integration Testing (End-to-end flows)
1. **Registration Flow:** register.html → POST /api/auth/register → redirect to transactions.html
2. **Login Flow:** login.html → POST /api/auth/login → redirect to transactions.html
3. **Send Money Flow:** transactions.html → search recipient → submit form → POST /api/transactions/send → show verification UI
4. **Verification Flow:** camera activation → capture frames → liveness test → POST /api/transactions/verify → transaction completion
5. **History Display:** transactions.html → GET /api/transactions → render transaction list

### Edge Cases to Test
- Insufficient balance: attempt transaction > available balance, expect error message
- High fraud score: create conditions for high fraud score (large amount, frequent transactions), expect transaction blocked
- Recipient not found: enter non-existent email, expect error before transaction creation
- Authentication expiry: wait for token to expire, attempt protected action, expect redirect to login
- Camera permission denied: deny camera access, expect graceful error message
- Network error: disconnect network, attempt transaction, expect retry option

---

## Database Schema Updates Needed

Current schema.sql is complete and has all necessary tables and columns. No schema changes required for Phase 1-3.

For Phase 4 (face recognition), schema already has:
- ✅ `users.face_registered` boolean flag
- ✅ `face_registrations` table with face_encoding, liveness_score, verification_count
- ✅ `transactions.face_verified` and `transactions.liveness_verified` boolean flags
- ✅ `transactions.verification_time` decimal for metrics

---

## Security Considerations

1. **Password Security:** Using bcryptjs with default 10 salt rounds, passwords never returned in API responses
2. **JWT Security:** Tokens expire in 24 hours (configurable via JWT_EXPIRES_IN env var), stored in localStorage (HTTPS recommended for production)
3. **SQL Injection Prevention:** Using parameterized queries with mysql2 prepared statements throughout
4. **Rate Limiting:** Already configured in server.js (100 requests per 15 minutes per IP)
5. **CORS:** Configured for specific origins in server.js (localhost:5500 for development)
6. **Authorization:** All transaction and user routes protected with verifyToken middleware
7. **Balance Validation:** Checking sufficient balance before creating transaction, using MySQL transactions for atomic balance updates
8. **Transaction Idempotency:** Unique transaction_id generation prevents duplicate processing
9. **Input Validation:** Using express-validator for all POST endpoints
10. **Face Data:** Phase 4 stores only encodings, not raw images (privacy-preserving)

---

## Environment Variables Required

Backend uses process.env with fallback defaults:
- `PORT` (default: 3000)
- `DB_HOST` (default: localhost)
- `DB_USER` (default: root)
- `DB_PASSWORD` (default: empty string)
- `DB_NAME` (default: facesecure_pay)
- `DB_PORT` (default: 3306)
- `JWT_SECRET` (REQUIRED - no default, must be set for production)
- `JWT_EXPIRES_IN` (default: 24h)
- `NODE_ENV` (default: development)
- `CORS_ORIGIN` (default: http://127.0.0.1:5500,http://localhost:5500)
- `RATE_LIMIT_WINDOW` (default: 15 minutes)
- `RATE_LIMIT_MAX` (default: 100 requests)

**Action Required:** Create `backend/.env` file before starting implementation with at minimum:
```
JWT_SECRET=your-secret-key-change-this-in-production
DB_PASSWORD=your-mysql-password
```

---

## Implementation Order Rationale

**Phase 1 first** because authentication is the foundation - without user accounts and login, transactions cannot be associated with users.

**Phase 2 before Phase 3** because backend APIs must exist before frontend can call them - this allows testing each endpoint with Postman before UI integration.

**Phase 3** connects the working backend to the existing UI, completing the user-facing transaction flow.

**Phase 4 is optional** and can be deferred because the transaction flow works with mock face verification - real face recognition adds security but isn't blocking for basic functionality.

Each phase is independently verifiable and leaves the system in a working state.

---

## Success Criteria

### Phase 1 Complete When:
- ✅ New users can register and receive ₹1000 starting balance
- ✅ Registered users can login and receive JWT token
- ✅ Protected /api/user/profile returns logged-in user data
- ✅ Frontend redirects work correctly (register → transactions, login → transactions)

### Phase 2 Complete When:
- ✅ Authenticated users can create pending transactions
- ✅ Fraud detection calculates scores correctly for different scenarios
- ✅ Transaction verification updates sender and recipient balances atomically
- ✅ Transaction history API returns paginated results with correct data

### Phase 3 Complete When:
- ✅ User can login, see balance, search recipient, submit transaction form
- ✅ Verification UI activates camera and displays video feed
- ✅ Transaction completes with mock verification and balances update in real-time
- ✅ Transaction history displays with correct formatting and status badges
- ✅ Full end-to-end flow works without errors in console

### Phase 4 Complete When (Optional):
- ✅ Python Flask face API running and responding to requests
- ✅ Users can register their face and encoding is stored
- ✅ Real liveness detection distinguishes live faces from photos
- ✅ Face matching requires >80% similarity to complete transaction
- ✅ Verification metrics are captured and stored in database

---

## Notes for Implementer

- Follow patterns from existing routes/admin.js and routes/reports.js for consistency
- All database queries use async/await with mysql2/promise pool (db.query)
- API responses always include {success: boolean, message: string, ...data}
- Frontend uses apiCall helper which automatically adds JWT token from localStorage
- Test each backend route with Postman before implementing frontend integration
- Use browser DevTools Network tab and Console to debug frontend issues
- Transaction verification must use MySQL transactions (BEGIN, COMMIT, ROLLBACK) for atomicity
- Keep fraud detection logic simple and deterministic for initial version
- Phase 4 Python API is completely separate service, not blocking Phases 1-3

