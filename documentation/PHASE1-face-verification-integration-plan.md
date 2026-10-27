# Phase 1: Face Verification Library Integration - Inspection Report

**Date:** October 26, 2026  
**Library:** @rajeevdesai/face-verification-api  
**Repository:** https://github.com/rajeevdesai/face-verification-api  

---

## ✅ Library Confirmation

### Package Details
- **Package:** `@rajeevdesai/face-verification-api`
- **Peer Dependencies:** `onnxruntime-web >=1.17.0`, `@mediapipe/tasks-vision >=0.10.0`
- **License:** MIT (code), Apache-2.0 (models)
- **Runtime:** **Browser-only** - NO Node.js support
- **Inference:** Client-side via WebAssembly

### Model Files (Downloaded via NPM script)
```bash
npx @rajeevdesai/face-verification-api download <directory>
```

**Files Downloaded:**
1. `face_landmarker.task` - MediaPipe FaceLandmarker (Apache-2.0)
2. `mobilefacenet.onnx` - facex_nano 256-D embedding (Apache-2.0)
3. `minifasnet_v2.onnx` - MiniFASNetV2 liveness crop 2.7 (Apache-2.0)
4. `minifasnet_v1se.onnx` - MiniFASNetV1SE liveness crop 4.0 (Apache-2.0)

### Key API Methods
```typescript
// Load models once at startup
await loadModels({
  faceLandmarkerPath: '/models/face_landmarker.task',
  recognitionModelPath: '/models/mobilefacenet.onnx',
  livenessModelPath: ['/models/minifasnet_v2.onnx', '/models/minifasnet_v1se.onnx'],
  liveness: [{ cropScale: 2.7 }, { cropScale: 4.0 }]
});

// Compare two faces
const result = await compareFaces(baselineImage, currentImage, {
  threshold: 0.5,              // Match cutoff (cosine distance)
  livenessThreshold: 0.5,      // Liveness score cutoff
  checkLiveness: true          // Enable liveness check
});
```

### Result Structure
```typescript
interface CompareResult {
  match: boolean;                    // Final verdict
  confidence: number;                // Margin below threshold (NOT probability)
  flags: FraudFlag[];               // Array of warning flags
  details: {
    baselineFacesFound: number;
    currentFacesFound: number;
    distance: number;               // Cosine distance (lower = more similar)
    threshold: number;
    livenessScore?: number;         // 0-1 score if liveness enabled
  };
}
```

### Fraud Flags
- `baseline_missing` - No face in baseline image
- `baseline_ambiguous` - Multiple faces in baseline (largest used)
- `face_missing` - No face in current image
- `multiple_faces` - Multiple faces in current (best match used)
- `identity_mismatch` - Distance > threshold
- `low_confidence` - Match but in grey zone (80-100% of threshold)
- `liveness_fail` - Liveness score below threshold (spoof suspected)

---

## 📂 Current Project Structure

### Frontend (http://127.0.0.1:5500/)
```
frontend/
├── index.html
├── login.html
├── register.html
├── face-registration.html          ← Existing face registration page
├── transactions.html               ← Main transaction page with verification
├── admin.html / admin-login.html
├── js/
│   ├── config.js                   ← API endpoints configuration
│   ├── utils.js
│   ├── auth.js
│   ├── transactions.js             ← Transaction flow & pending receipts
│   ├── face-verification.js        ← **CURRENT SIMULATED VERIFICATION**
│   ├── admin.js
│   ├── dashboard.js
│   └── reports.js
└── styles/
    ├── main.css
    ├── auth.css
    └── transactions.css
```

### Backend (http://localhost:3000/)
```
backend/
├── server.js
├── routes/
│   ├── auth.js                     ← Login, registration, payment number lookup
│   ├── transactions.js             ← **CONTAINS /verify endpoint (HTTP 500 issue)**
│   ├── face.js                     ← Face registration endpoint
│   ├── admin.js
│   └── reports.js
├── middleware/
│   └── auth.js                     ← JWT token verification
├── services/
│   └── fraudDetection.js           ← Fraud screening logic
└── config/
    ├── database.js                 ← MySQL connection
    └── schema.sql
```

### Database (MySQL "nada")
```sql
-- Key tables:
users (
  id, username, email, password_hash, full_name,
  payment_number, balance, face_registered
)

face_registrations (
  id, user_id, face_encoding,
  face_photo LONGBLOB,              ← Currently stores raw image
  photo_format, photo_size,
  photo_uploaded_at, is_active
)

transactions (
  id, transaction_id, sender_id, recipient_id,
  amount, status, description,
  sender_verified, sender_verification_time,
  recipient_verified, recipient_verification_time,
  verification_stage,               ← 'pending_sender' | 'pending_recipient' | 'both_verified'
  fraud_score, fraud_check_passed,
  liveness_score
)
```

---

## 🔍 Current Implementation Analysis

### Existing Face Verification (face-verification.js)
**Status:** **SIMULATED** - No real face comparison

**Current Flow:**
1. `startVerification()` - Main entry point
2. `initializeCamera()` - Starts webcam
3. `startFaceDetection()` - Simulates face detection (creates blue box)
4. `runLivenessChallenges()` - Simulates 4 challenges (blink, turn left/right, smile)
   - **Uses random scores 70-95** (no actual detection)
5. `captureFrame()` - Captures image as base64 data URL
6. `verifyTransaction()` / `verifyTransactionAsRecipient()` - Sends to backend
   - **Only sends `faceVerified: true` and `livenessScore` (simulated)**
   - **NO actual face comparison happens**

**Problems:**
- ❌ No face detection (blue box is just visual, not tied to actual face)
- ❌ No liveness detection (challenges are timer-based, scores are random)
- ❌ No face comparison (doesn't compare captured image to registered face)
- ❌ Frontend can send `faceVerified: true` without any real check

### Face Registration (Modal in transactions.html)
**Location:** Modal popup in transactions page  
**Flow:**
1. Click "📸 Register Face" → Opens camera modal
2. Capture photo → Shows preview
3. Click "Save & Register" → Sends base64 image to backend
4. Backend stores image in `face_registrations.face_photo` as LONGBLOB

**Storage:** Raw JPEG base64 → converted to BLOB  
**Issue:** No face template/embedding stored, just raw image

### Backend /verify Endpoint (HTTP 500 Issue)
**Location:** `backend/routes/transactions.js` line ~238

**Current Implementation:**
```javascript
router.post('/verify', verifyToken, async (req, res) => {
  // Accepts: transactionId, faceVerified (boolean), livenessScore (number)
  // Problem: No actual face comparison, trusts client-side faceVerified flag
  // HTTP 500 likely due to database transaction lock or balance check failure
});
```

**Dual Verification Endpoints (Working):**
- `POST /api/transactions/verify-sender` - Phase 1 (sender verifies)
- `POST /api/transactions/verify-recipient` - Phase 2 (recipient verifies)
- `GET /api/transactions/pending-receipts` - Get pending receipts

---

## 🎯 Integration Architecture

### How the Library Will Fit

**Library Constraints:**
- ✅ **Browser-only** - Runs in frontend, NOT backend Node.js
- ✅ Requires `createImageBitmap`, `OffscreenCanvas`, WebAssembly
- ✅ Models loaded once as singletons
- ✅ Returns structured results with fraud flags

**Integration Point:** **Frontend face-verification.js**

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser) - http://127.0.0.1:5500/                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Load Models (Once at page load)                        │
│     loadModels({                                            │
│       faceLandmarkerPath: '/models/face_landmarker.task',  │
│       recognitionModelPath: '/models/mobilefacenet.onnx',  │
│       livenessModelPath: [...minifasnet models]            │
│     })                                                      │
│                                                             │
│  2. Face Registration (Enrollment)                         │
│     - Capture photo                                        │
│     - compareFaces(capturedPhoto, capturedPhoto)           │
│       → Verify single face detected                        │
│     - Store: base64 image → backend                        │
│     - Backend: Save to face_registrations.face_photo       │
│                                                             │
│  3. Face Verification (Transaction)                        │
│     a) Fetch registered face from backend                  │
│     b) Capture live photo from camera                      │
│     c) result = compareFaces(registeredFace, livePhoto, {  │
│          threshold: 0.5,                                    │
│          livenessThreshold: 0.5,                           │
│          checkLiveness: true                               │
│        })                                                   │
│     d) Check result.match, result.flags, result.details    │
│     e) Send verification session to backend with:          │
│        - transactionId                                     │
│        - verificationSessionId (server-generated)          │
│        - result summary (match, confidence, flags)         │
│        - timestamp                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (Node.js) - http://localhost:3000/                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Face Registration Endpoint                             │
│     POST /api/face/register                                │
│     - Receives: base64 face photo                          │
│     - Validates: JWT token                                 │
│     - Stores: Raw image in face_registrations.face_photo   │
│     - Sets: users.face_registered = 1                      │
│                                                             │
│  2. Get Registered Face                                    │
│     GET /api/face/registered                               │
│     - Returns: base64 image for frontend comparison        │
│                                                             │
│  3. Verification Endpoints (Enhanced)                      │
│     POST /api/transactions/verify-sender                   │
│     POST /api/transactions/verify-recipient                │
│     - Receives: verification session data from frontend    │
│     - Validates:                                           │
│       ✓ JWT token (user identity)                          │
│       ✓ Transaction exists and is pending                  │
│       ✓ Fraud check passed                                 │
│       ✓ User has registered face                           │
│       ✓ Verification session not expired                   │
│       ✓ Sender/recipient role matches                      │
│     - DOES NOT trust client match result blindly           │
│     - Uses verification session as proof of attempt        │
│     - Records: liveness score, confidence, flags           │
│     - Executes: Balance transfer (atomic DB transaction)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Security Model

**⚠️ CRITICAL: Browser Inference Limitation**

The library runs in the browser, so the verification result is **NOT tamper-proof**.

**Security Measures:**
1. **Verification Sessions (Server-Generated)**
   - Backend creates unique session ID with short expiration (~2 minutes)
   - Frontend must complete verification within session window
   - Session tied to specific transaction + user + timestamp

2. **Multi-Factor Validation**
   - ✅ JWT token (proves user identity)
   - ✅ Face registration check (backend verifies face_registered = 1)
   - ✅ Fraud screening (separate fraud_score check)
   - ✅ Dual verification (both sender and recipient must verify)
   - ✅ Session expiration (prevent replay attacks)
   - ✅ Transaction state checks (pending → verified transitions)

3. **What Backend DOES NOT Trust:**
   - ❌ Client-provided `faceVerified: true` flag
   - ❌ Client-provided match scores
   - ❌ Client-provided liveness scores (for final decision)

4. **What Backend DOES Trust:**
   - ✅ Verification session was created and not expired
   - ✅ User completed the verification flow (frontend called library)
   - ✅ Multiple fraud signals combined (not just face)

**Documentation Requirement:**
> ⚠️ **Security Limitation:** Face comparison runs in the browser using WebAssembly. 
> While the library provides legitimate verification, a malicious user with 
> browser DevTools could bypass checks. This system combines face verification 
> with fraud screening, dual verification, and session management to increase 
> security, but should NOT be used as the sole authentication factor for 
> high-value transactions without additional server-side controls.

---

## 📋 Files That Will Be Modified

### Phase 2: Installation & Models
**New Files Created:**
- `frontend/models/face_landmarker.task` (downloaded)
- `frontend/models/mobilefacenet.onnx` (downloaded)
- `frontend/models/minifasnet_v2.onnx` (downloaded)
- `frontend/models/minifasnet_v1se.onnx` (downloaded)
- `frontend/js/face-api-wrapper.js` ← NEW (wrapper for library)

### Phase 3: Face Enrollment
**Modified:**
- `frontend/js/transactions.js` - Update face registration modal
- `backend/routes/face.js` - Enhance registration endpoint validation

**No database migration needed** - face_photo LONGBLOB already exists

### Phase 4: Real Face Comparison
**Modified:**
- `frontend/js/face-verification.js` - Replace simulated logic with real library calls
- `frontend/js/config.js` - Add GET_REGISTERED_FACE endpoint

**New:**
- `frontend/js/face-api-wrapper.js` - Wrapper for library initialization

### Phase 5: Backend Integration
**Modified:**
- `backend/routes/transactions.js`:
  - Fix HTTP 500 in POST /verify
  - Enhance verify-sender and verify-recipient endpoints
  - Add verification session management
- `backend/routes/face.js`:
  - Add GET /api/face/registered endpoint

### Phase 6: Testing
**New:**
- `documentation/face-verification-test-results.md`

---

## ⚠️ Known Risks & Limitations

### From Library Documentation

1. **Thresholds Uncalibrated**
   - Default `threshold: 0.5` and `livenessThreshold: 0.5` are placeholders
   - Must calibrate on own data using demo/calibrate.html
   - Distances not comparable across models

2. **Liveness Not Complete Spoof Defense**
   - Reliably rejects screen/video replay
   - **Print photos can occasionally pass** (documented limitation)
   - Should pair with another authentication factor

3. **Accuracy Bounded by Model**
   - facex_nano: ~95.62% on LFW benchmark
   - Real-world (pose, lighting, occlusion) will be lower
   - Expect some error, design for graceful degradation

4. **Browser-Only Execution**
   - Cannot run in Node.js backend
   - All inference happens client-side
   - Results are not tamper-proof without additional server validation

5. **Model Licensing**
   - Apache-2.0 licenses
   - MS1M-RefineV2 training data caveat (see NOTICE file)

### Project-Specific Risks

1. **Existing Users Without Face Registration**
   - Must handle gracefully (show enrollment prompt)
   - Cannot force enrollment (UX issue)
   - Allow transactions without face verification? (Security vs UX trade-off)

2. **HTTP 500 in /verify Endpoint**
   - Root cause: Needs investigation (likely DB transaction lock)
   - May affect dual verification flow
   - Must fix before integration

3. **Model Download Size**
   - Total: ~15-20 MB
   - face_landmarker.task: ~9 MB
   - mobilefacenet.onnx: ~4 MB
   - minifasnet models: ~2-3 MB each
   - Impact: First load will be slow on slow connections

4. **Camera Permission Required**
   - Users can deny camera access
   - Must handle permission denial gracefully
   - Cannot complete verification without camera

---

## ✅ Phase 1 Complete - Ready for Phase 2

### Summary

**Library Confirmed:**
- ✅ @rajeevdesai/face-verification-api is browser-only (client-side inference)
- ✅ API methods: `loadModels()`, `compareFaces()`
- ✅ Model files: 4 files, ~15-20 MB total, downloaded via NPM script
- ✅ Returns structured results with fraud flags
- ✅ Liveness ensemble included (screen replay detection)

**Current Project State:**
- ✅ Frontend uses Live Server (no bundler required, can serve static models)
- ✅ Face registration modal exists (stores raw images)
- ✅ Dual verification flow implemented (sender → recipient)
- ✅ Database schema ready (face_photo LONGBLOB exists)
- ⚠️ Current verification is simulated (random scores)
- ⚠️ HTTP 500 in /verify endpoint (needs investigation)

**Integration Plan:**
- ✅ Install library and peers in frontend directory
- ✅ Download models to `frontend/models/`
- ✅ Create wrapper module for library initialization
- ✅ Replace simulated verification with real library calls
- ✅ Add verification session management on backend
- ✅ Document security limitations clearly

**Security Approach:**
- ✅ Browser-based verification combined with server validation
- ✅ Verification sessions with expiration
- ✅ Multi-factor checks (face + fraud + dual verification + session)
- ✅ Clear documentation of trust boundaries

**Ready to proceed to Phase 2: Installation**

---

**Next Steps:**
1. Install npm packages in frontend directory
2. Download model files to frontend/models/
3. Configure Live Server to serve models/
4. Test library loading in browser console

