# FaceSecure Pay - Transaction System Implementation Plan

## Overview
This document outlines the complete implementation plan for the transaction page - the core of FaceSecure Pay where users send money with face verification and fraud detection.

## Current Status
✅ Frontend transaction page created (`transactions.html`)  
✅ Basic backend structure exists  
🚧 Need to implement full transaction flow  

---

## Implementation Tasks

### Phase 1: User Authentication System
**Priority: HIGH**

#### Backend Tasks:
1. **User Registration Endpoint** (`POST /api/auth/register`)
   - Validate email, password, full name, phone
   - Hash password with bcrypt
   - Create user record in database
   - Return JWT token
   - Starting balance: ₹1000

2. **User Login Endpoint** (`POST /api/auth/login`)
   - Validate credentials
   - Generate JWT token
   - Update last_login timestamp
   - Return user data + token

3. **Get User Profile** (`GET /api/user/profile`)
   - Protected route (requires JWT)
   - Return user details + balance

4. **Search User** (`GET /api/user/search?query=email`)
   - Find user by email/phone for recipient lookup
   - Return only public info (name, email, id)

#### Frontend Tasks:
1. Create `login.html` page
2. Create `register.html` page
3. Update `auth.js` with login/register functions
4. Add session management (check token on page load)
5. Redirect to transactions.html after login

---

### Phase 2: Transaction Processing Backend
**Priority: HIGH**

#### 1. Create Transaction Endpoint (`POST /api/transactions/send`)

**Request Body:**
```json
{
  "recipientEmail": "user@example.com",
  "amount": 100.50,
  "description": "Payment for services",
  "transactionType": "personal"
}
```

**Process Flow:**
1. Verify user is authenticated (JWT middleware)
2. Validate recipient exists
3. Check sender has sufficient balance
4. Create transaction record (status: 'pending')
5. Generate unique transaction_id (TX123ABC456)
6. Return transaction_id for verification

**Response:**
```json
{
  "success": true,
  "transactionId": "TX123ABC456",
  "amount": 100.50,
  "requiresVerification": true,
  "recipient": {
    "name": "John Doe",
    "email": "user@example.com"
  }
}
```

#### 2. Fraud Check Endpoint (`POST /api/fraud/check`)

**Fraud Detection Logic:**
```javascript
// Calculate fraud score (0-100)
let fraudScore = 0;

// Check 1: Amount anomaly (>50% of balance)
if (amount > balance * 0.5) fraudScore += 30;

// Check 2: High frequency (>5 transactions in 1 hour)
if (recentTransactionCount > 5) fraudScore += 25;

// Check 3: New recipient (never sent before)
if (!previouslySentTo) fraudScore += 15;

// Check 4: Unusual time (2 AM - 5 AM)
if (hour >= 2 && hour <= 5) fraudScore += 10;

// Check 5: High amount (>₹10,000)
if (amount > 10000) fraudScore += 20;

// Verdict
if (fraudScore >= 70) return 'HIGH_RISK'; // Block
if (fraudScore >= 40) return 'MEDIUM_RISK'; // Extra verification
return 'LOW_RISK'; // Proceed
```

#### 3. Face Verification Endpoint (`POST /api/transactions/verify`)

**Request Body:**
```json
{
  "transactionId": "TX123ABC456",
  "faceImage": "base64_image_data",
  "livenessScore": 85,
  "livenessData": {...}
}
```

**Process:**
1. Load user's registered face encoding from database
2. Compare with captured face image
3. Verify liveness score > 60
4. If match (>80% similarity):
   - Update transaction status to 'processing'
   - Deduct from sender balance
   - Add to recipient balance
   - Set status to 'completed'
   - Record verification time
5. If no match:
   - Set status to 'failed'
   - Don't transfer funds

#### 4. Get User Transactions (`GET /api/transactions`)

**Query Params:**
- `?type=sent|received|all` (default: all)
- `?limit=20` (default: 20)
- `?page=1` (default: 1)
- `?status=completed|pending|failed` (optional)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 1,
      "transaction_id": "TX123ABC456",
      "type": "sent",
      "amount": 100.50,
      "recipient": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "status": "completed",
      "face_verified": true,
      "fraud_score": 15,
      "description": "Payment for services",
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:31:23Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### Phase 3: Face Verification System
**Priority: HIGH**

#### Backend Tasks:

1. **Face Registration Endpoint** (`POST /api/face/register`)
   - Accept base64 face image
   - Extract face encoding using Python/MediaPipe
   - Store encoding in `face_registrations` table
   - Mark user as `face_registered = true`

2. **Liveness Check Endpoint** (`POST /api/face/liveness`)
   - Call Python liveness detection API
   - Verify face is real (not photo/video)
   - Return liveness score (0-100)

3. **Face Match Endpoint** (`POST /api/face/match`)
   - Compare captured face with registered face
   - Return similarity score (0-100)
   - Threshold: 80% for match

#### Frontend Tasks:

1. **Update `face-verification.js`:**

```javascript
// Camera access
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ 
    video: { 
      width: 640, 
      height: 480,
      facingMode: 'user' 
    } 
  });
  videoElement.srcObject = stream;
}

// Capture frame
function captureFrame() {
  const canvas = document.getElementById('camera-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 640;
  canvas.height = 480;
  ctx.drawImage(videoElement, 0, 0);
  return canvas.toDataURL('image/jpeg');
}

// Liveness challenges
const challenges = [
  { id: 'blink', text: 'Please blink' },
  { id: 'turn_left', text: 'Turn your head left' },
  { id: 'turn_right', text: 'Turn your head right' },
  { id: 'smile', text: 'Please smile' }
];

// Run verification
async function runVerification(transactionId) {
  // Step 1: Fraud check
  updateStep('fraud', 'active');
  await fraudCheck(transactionId);
  updateStep('fraud', 'complete');
  
  // Step 2: Start camera & liveness
  updateStep('liveness', 'active');
  await startCamera();
  const livenessResult = await runLivenessTest();
  updateStep('liveness', 'complete');
  
  // Step 3: Face match
  updateStep('face', 'active');
  const faceImage = captureFrame();
  const matchResult = await verifyFace(transactionId, faceImage, livenessResult);
  updateStep('face', 'complete');
  
  // Step 4: Complete
  updateStep('complete', 'complete');
  
  if (matchResult.success) {
    showSuccess('Transaction completed successfully!');
    loadTransactionHistory();
  } else {
    showError('Verification failed: ' + matchResult.message);
  }
}
```

---

### Phase 4: Database Schema Updates

Add columns if missing:

```sql
-- Add verification tracking to transactions
ALTER TABLE transactions ADD COLUMN verification_attempts INT DEFAULT 0;
ALTER TABLE transactions ADD COLUMN last_verification_attempt TIMESTAMP NULL;

-- Add fraud tracking
ALTER TABLE transactions ADD COLUMN fraud_check_result VARCHAR(20);
ALTER TABLE transactions ADD COLUMN fraud_details JSON;

-- Add transaction metrics
ALTER TABLE transactions ADD COLUMN verification_duration DECIMAL(5,2);
ALTER TABLE transactions ADD COLUMN processing_time DECIMAL(5,2);
```

---

### Phase 5: Frontend Integration

#### Update `transactions.js`:

```javascript
// Load user data on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const token = localStorage.getItem('facepay_token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  
  // Load user profile
  await loadUserProfile();
  
  // Load transactions
  await loadTransactionHistory();
});

// Handle send money form
document.getElementById('send-money-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    recipientEmail: document.getElementById('recipient-email').value,
    amount: parseFloat(document.getElementById('amount').value),
    description: document.getElementById('description').value,
    transactionType: document.getElementById('transaction-type').value
  };
  
  try {
    // Step 1: Create transaction
    const response = await apiCall(API.SEND_MONEY, {
      method: 'POST',
      body: formData
    });
    
    if (response.success) {
      // Show verification section
      document.getElementById('verification-section').classList.add('show');
      
      // Store transaction ID for verification
      window.currentTransactionId = response.transactionId;
    }
  } catch (error) {
    showError(error.message);
  }
});

// Start verification process
async function startVerification() {
  const transactionId = window.currentTransactionId;
  await runVerification(transactionId);
}
```

---

### Phase 6: Python Liveness API
**Priority: MEDIUM**

Create separate Python Flask API for face detection:

**File: `python-face-api/app.py`**

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import mediapipe as mp

app = Flask(__name__)
CORS(app)

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh()

@app.route('/api/liveness/check', methods=['POST'])
def check_liveness():
    data = request.json
    image_data = data['image']
    
    # Decode base64 image
    img_bytes = base64.b64decode(image_data.split(',')[1])
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Face detection
    results = face_mesh.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    
    if not results.multi_face_landmarks:
        return jsonify({
            'success': False,
            'message': 'No face detected'
        })
    
    # Liveness checks
    liveness_score = calculate_liveness(results.multi_face_landmarks[0])
    
    return jsonify({
        'success': True,
        'livenessScore': liveness_score,
        'isLive': liveness_score > 60
    })

def calculate_liveness(landmarks):
    # Check eye aspect ratio for blink detection
    # Check head pose for movement
    # Check texture analysis
    # Return score 0-100
    pass

if __name__ == '__main__':
    app.run(port=5000, debug=True)
```

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/user/profile` - Get user profile
- `GET /api/user/search` - Search for recipient

### Transactions
- `POST /api/transactions/send` - Initiate transaction
- `GET /api/transactions` - Get user transactions
- `GET /api/transactions/:id` - Get transaction details
- `POST /api/transactions/verify` - Complete with verification

### Face Verification
- `POST /api/face/register` - Register user's face
- `POST /api/face/verify` - Verify face for transaction
- `POST /api/face/liveness` - Check liveness

### Fraud Detection
- `POST /api/fraud/check` - Run fraud analysis

---

## Testing Checklist

### User Flow:
1. ✅ Register new account
2. ✅ Login with credentials
3. ✅ View balance (₹1000 starting)
4. ✅ Search for recipient
5. ✅ Enter transaction amount
6. ✅ Run fraud check
7. ✅ Complete liveness test
8. ✅ Verify face match
9. ✅ Transaction completed
10. ✅ Balance updated
11. ✅ Transaction appears in history

### Edge Cases:
- Insufficient balance → Show error
- High fraud score → Block transaction
- Face mismatch → Fail verification
- No camera access → Show error
- Network error → Retry option

---

## Security Considerations

1. **JWT Security**
   - Short expiration (24 hours)
   - Refresh token mechanism
   - Secure HTTP-only cookies in production

2. **Transaction Security**
   - Double-entry accounting (debit/credit)
   - Transaction rollback on verification failure
   - Idempotency keys to prevent duplicate transactions

3. **Face Data Security**
   - Store encodings, not raw images
   - Encrypt face encodings in database
   - Delete failed verification attempts after 24 hours

4. **API Security**
   - Rate limiting per user
   - CAPTCHA on repeated failures
   - IP blocking on suspicious activity

---

## Next Steps

1. **Immediate**: Implement user auth (login/register)
2. **Phase 2**: Build transaction API endpoints
3. **Phase 3**: Integrate face verification
4. **Phase 4**: Add fraud detection logic
5. **Phase 5**: Python liveness API
6. **Phase 6**: Testing & refinement

---

## File Structure After Implementation

```
facesecure-pay/
├── backend/
│   ├── routes/
│   │   ├── auth.js          ← NEW
│   │   ├── transactions.js  ← NEW
│   │   ├── face.js          ← NEW
│   │   ├── fraud.js         ← NEW
│   │   ├── admin.js
│   │   └── reports.js
│   ├── controllers/
│   │   ├── authController.js      ← NEW
│   │   ├── transactionController.js ← NEW
│   │   └── faceController.js      ← NEW
│   ├── services/
│   │   ├── fraudDetection.js      ← NEW
│   │   └── faceComparison.js      ← NEW
│   └── ...
│
├── frontend/
│   ├── login.html           ← NEW
│   ├── register.html        ← NEW
│   ├── transactions.html    ← CREATED
│   └── ...
│
└── python-face-api/         ← NEW
    ├── app.py
    ├── requirements.txt
    └── models/
```

---

This is your complete roadmap! Ready to implement? 🚀
