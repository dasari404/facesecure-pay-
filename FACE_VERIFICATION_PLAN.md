# FacePay - Face Verification Implementation Plan

## Overview
Add face verification to FacePay transactions using webcam + MediaPipe + liveness detection to prevent fraud.

---

## Implementation Stages

### Stage 1: Face Detection (Basic)
**Goal:** Get camera working and detect if a face is present

**Technology:**
- Browser Webcam API (getUserMedia)
- MediaPipe Face Landmarker (@mediapipe/tasks-vision)

**What to Build:**
- React component with live camera preview
- Face detection indicator (✓ Face detected / ⚠ No face)
- Real-time bounding box around detected face

**Installation:**
```bash
npm install @mediapipe/tasks-vision
```

**Resources:**
- [MediaPipe Face Landmarker Guide](https://developers.google.com/mediapipe/solutions/vision/face_landmarker/web_js)
- Official examples and documentation

---

### Stage 2: Liveness Challenges (Interactive)
**Goal:** User performs actions to prove they're live

**Challenges to Implement:**
1. **Blink Detection** - Ask user to blink
2. **Head Turn** - Ask user to turn head left/right
3. **Mouth Open** - Ask user to open mouth
4. **Random Selection** - System picks 2-3 random challenges

**How it Works:**
- Random challenge displayed on screen
- MediaPipe detects facial landmarks
- Verify user completed the action
- Pass/Fail result

**Limitations:**
⚠️ These actions alone CANNOT reliably defeat:
- Printed photos (static)
- Video replays (recorded actions)
- High-quality masks

---

### Stage 3: Anti-Spoofing Detection (Advanced)
**Goal:** Distinguish live person from presentation attacks

**What to Detect:**
- ❌ Printed photos
- ❌ Phone screen replays
- ❌ Video recordings
- ❌ High-quality masks
- ✅ Real live person

**Technology Options:**

#### Option A: Python Liveness App (Already Available!)
- **Repository:** `liveness_app/` (already in project!)
- **Location:** `C:\Users\akinu\OneDrive\Pictures\timetable\ip-3\liveness_app\`
- **Features:**
  - Passive checks (blink, mouth movement, texture)
  - Active challenges (random actions)
  - Liveness scoring (0-100)
  - Texture analysis (detect flat surfaces)
  - Pseudo-depth checks

**Integration Plan:**
1. Keep Python Flask API running (`liveness_app/api_server.py`)
2. React sends camera frame to Python API
3. Python returns liveness score + verification result
4. React displays result and passes to transaction flow

#### Option B: MediaPipe + Custom Model
- Train/use anti-spoofing CNN model
- Integrate directly in React/Node.js
- More complex but self-contained

**Recommendation:** Use Option A (liveness_app) - already set up and tested!

---

### Stage 4: Connect to FacePay Transactions
**Goal:** Enforce face verification before payments

**Transaction Flow with Face Verification:**

```
User initiates payment
    ↓
Check fraud database (existing)
    ↓
IF fraud match → Block transaction
    ↓
IF clean → REQUIRE FACE VERIFICATION
    ↓
Open camera modal
    ↓
Run face detection
    ↓
Run liveness challenges
    ↓
Run anti-spoofing check
    ↓
Verification passed? → Process payment
    ↓
Verification failed? → Block transaction + record reason
    ↓
Camera unavailable? → Block transaction (DO NOT pass by default)
```

**Backend Validation:**
- Backend receives verification result from frontend
- Backend validates the result is trustworthy
- Backend records verification attempt (pass/fail/unavailable)
- **Never trust client-side only** - backend must verify

**Database Updates:**
```sql
ALTER TABLE transactions 
ADD COLUMN face_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN verification_score DECIMAL(5,2),
ADD COLUMN verification_timestamp TIMESTAMP;

CREATE TABLE verification_attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  transaction_id VARCHAR(36),
  result ENUM('passed', 'failed', 'unavailable'),
  liveness_score DECIMAL(5,2),
  anti_spoof_score DECIMAL(5,2),
  timestamp TIMESTAMP,
  failure_reason TEXT
);
```

---

## Development Roadmap

### Phase 1: Basic Camera Setup ✓ (Already Done!)
- ✅ Python liveness API running (port 5000)
- ✅ Face detection with MediaPipe
- ✅ Real-time bounding box overlay
- ✅ Liveness score display

### Phase 2: React Integration (Next Steps)
**Step 1:** Create Face Verification Component
- [ ] React component with camera access
- [ ] MediaPipe Face Landmarker integration
- [ ] Display live video feed
- [ ] Show face detection status

**Step 2:** Add Liveness Challenges
- [ ] Random challenge selector
- [ ] Visual instructions on screen
- [ ] Landmark-based action detection
- [ ] Challenge completion tracking

**Step 3:** Integrate Anti-Spoofing
- [ ] Connect to Python liveness API (port 5000)
- [ ] Send camera frames for analysis
- [ ] Receive liveness score + verification
- [ ] Display results to user

**Step 4:** Connect to Transaction Flow
- [ ] Add "Verify Face" button before payment
- [ ] Show verification modal during transaction
- [ ] Send verification result to backend
- [ ] Backend validates and processes/blocks payment

---

## Testing Strategy

### Test Cases to Cover:

**Genuine Users:**
- ✅ Normal lighting
- ✅ Different angles
- ✅ With/without glasses
- ✅ Different face shapes

**Spoof Attacks:**
- ❌ Printed photo (A4 paper)
- ❌ Phone screen replay (recorded video)
- ❌ Tablet screen replay
- ❌ Photo on laptop screen
- ❌ Low-quality mask

**Edge Cases:**
- Poor lighting
- Camera quality
- Network latency
- Camera permission denied
- API unavailable

**Security Rules:**
- Failed verification = BLOCK transaction
- Unavailable verification = BLOCK transaction
- Only "PASSED" verification = ALLOW transaction
- Log all attempts for audit

---

## Architecture

### Frontend (React)
```
FaceVerificationModal.jsx
├── Camera Component
│   ├── Webcam access
│   ├── MediaPipe Face Landmarker
│   └── Real-time face detection
├── Challenge Display
│   ├── Random action selector
│   ├── Instruction UI
│   └── Progress indicator
├── Anti-Spoofing Check
│   ├── API call to Python service
│   ├── Liveness score display
│   └── Verification result
└── Result Handler
    ├── Pass → Continue transaction
    ├── Fail → Block transaction
    └── Error → Block transaction
```

### Backend (Node.js)
```
POST /api/transaction/verify-face
├── Receive verification data
├── Validate result authenticity
├── Store verification attempt
├── Return pass/fail to frontend

POST /api/transaction/send
├── Check fraud database (existing)
├── Require face verification result
├── Validate verification timestamp (recent)
├── Process or block transaction
```

### Python API (Already Running)
```
POST /api/detect-face
├── Receive base64 image
├── Run MediaPipe face mesh
├── Calculate liveness score
├── Detect spoofing attempts
└── Return verification result
```

---

## Security Considerations

### Client-Side (React)
- Request camera permission
- Display clear instructions
- Show real-time feedback
- Handle errors gracefully
- **DO NOT trust client verification alone**

### Server-Side (Node.js)
- Validate verification result
- Check timestamp (must be recent)
- Store all attempts (audit trail)
- **Never allow transaction without verification**
- **Treat unavailable as FAIL, not PASS**

### Anti-Tampering
- Use HTTPS
- Add request signing
- Validate image authenticity
- Prevent replay attacks (timestamp check)
- Rate limiting on verification attempts

---

## Files to Create

### Frontend (React)
```
src/
├── components/
│   ├── FaceVerificationModal.jsx
│   ├── CameraPreview.jsx
│   ├── LivenessChallenge.jsx
│   ├── VerificationResult.jsx
│   └── FaceDetectionBox.jsx
├── utils/
│   ├── mediapipe-setup.js
│   ├── face-landmarks.js
│   ├── liveness-api.js
│   └── challenge-logic.js
└── styles/
    └── face-verification.css
```

### Backend (Node.js)
```
backend/
├── routes/
│   └── face-verification.js
├── middleware/
│   └── verify-face-result.js
└── models/
    └── verification-attempts.js
```

---

## Installation Commands

### Frontend Dependencies
```bash
cd facesecure-pay/frontend
npm install @mediapipe/tasks-vision
npm install axios
```

### Python API (Already Set Up)
```bash
# Already running at:
# http://localhost:5000
# 
# API endpoint:
# POST http://localhost:5000/api/detect-face
```

---

## Next Steps (Waiting for Your Command)

1. **Create React Face Verification Component** with camera access
2. **Integrate MediaPipe Face Landmarker** for face detection
3. **Add liveness challenges** (blink, turn head, etc.)
4. **Connect to Python anti-spoofing API** (already running)
5. **Integrate into transaction flow** with backend validation

---

## Status: ANALYZED & WAITING 🎯

I understand the complete face verification system design. Ready to build when you give the command!

**Key Points:**
- ✅ Stage 1: Face detection (MediaPipe)
- ✅ Stage 2: Liveness challenges (interactive)
- ✅ Stage 3: Anti-spoofing (Python API already available!)
- ✅ Stage 4: Transaction integration (backend validation)
- ✅ Security: Failed/unavailable = BLOCK (never pass by default)
