// Face Verification Logic

let cameraStream = null;
let verificationInProgress = false;

// Update verification step UI
function updateStep(stepName, status) {
  const stepEl = document.querySelector(`[data-step="${stepName}"]`);
  if (stepEl) {
    stepEl.classList.remove('active', 'complete');
    if (status === 'active') {
      stepEl.classList.add('active');
    } else if (status === 'complete') {
      stepEl.classList.add('complete');
    }
  }
}

// Start camera and verification process
async function startVerification() {
  if (verificationInProgress) {
    return;
  }
  
  if (!currentTransactionId) {
    alert('No transaction to verify');
    return;
  }
  
  verificationInProgress = true;
  
  try {
    // Show camera view
    document.getElementById('camera-view').classList.add('show');
    document.getElementById('start-verification-btn').style.display = 'none';
    
    // Step 1: Fraud Check
    updateStep('fraud', 'active');
    document.getElementById('liveness-instruction').textContent = 'Running fraud detection...';
    
    await runFraudCheck(currentTransactionId);
    
    updateStep('fraud', 'complete');
    await sleep(500);
    
    // Step 2: Initialize Camera
    updateStep('liveness', 'active');
    document.getElementById('liveness-instruction').textContent = 'Initializing camera...';
    
    await initializeCamera();
    
    // Step 3: Liveness Test
    document.getElementById('liveness-instruction').textContent = 'Position your face in the circle';
    await sleep(2000);
    
    const livenessResult = await runLivenessTest();
    
    updateStep('liveness', 'complete');
    await sleep(500);
    
    // Step 4: Face Verification
    updateStep('face', 'active');
    document.getElementById('liveness-instruction').textContent = 'Verifying your face...';
    
    const faceImage = captureFrame();
    
    await verifyTransaction(currentTransactionId, faceImage, livenessResult);
    
    updateStep('face', 'complete');
    await sleep(500);
    
    // Step 5: Complete
    updateStep('complete', 'complete');
    
    // Show success message
    document.getElementById('verification-message').innerHTML = `
      <div style="color: #10b981; font-size: 18px; font-weight: 600;">
        ✅ Transaction Completed Successfully!
      </div>
      <p style="color: var(--text-secondary); margin-top: 8px;">
        Your money has been sent securely.
      </p>
    `;
    
    // Reload user profile and transaction history
    await loadUserProfile();
    await loadTransactionHistory();
    
    // Reset form after delay
    setTimeout(() => {
      cancelVerification();
      document.getElementById('verification-message').innerHTML = '';
    }, 3000);
    
  } catch (error) {
    console.error('Verification error:', error);
    
    document.getElementById('verification-message').innerHTML = `
      <div style="color: #ef4444; font-size: 18px; font-weight: 600;">
        ❌ Verification Failed
      </div>
      <p style="color: var(--text-secondary); margin-top: 8px;">
        ${error.message || 'Please try again.'}
      </p>
    `;
    
    document.getElementById('start-verification-btn').style.display = 'inline-block';
  } finally {
    verificationInProgress = false;
    
    // Stop camera
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
  }
}

// Initialize camera
async function initializeCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: 640, 
        height: 480, 
        facingMode: 'user' 
      } 
    });
    
    const video = document.getElementById('camera-video');
    video.srcObject = cameraStream;
    
    // Wait for video to be ready
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        resolve();
      };
    });
  } catch (error) {
    console.error('Camera initialization error:', error);
    throw new Error('Failed to access camera. Please check permissions.');
  }
}

// Capture frame from video
function captureFrame() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  return canvas.toDataURL('image/jpeg', 0.8);
}

// Run liveness test (simplified version with mock challenges)
async function runLivenessTest() {
  const challenges = getRandomChallenges(2);
  
  for (const challenge of challenges) {
    document.getElementById('liveness-instruction').textContent = challenge.instruction;
    await sleep(challenge.duration);
  }
  
  // Mock liveness score (in production, this would be calculated by face detection AI)
  const livenessScore = Math.floor(Math.random() * 20) + 75; // 75-95
  
  return {
    livenessScore,
    passed: livenessScore >= CONFIG.LIVENESS_THRESHOLD,
    challenges: challenges.map(c => c.id)
  };
}

// Run fraud check
async function runFraudCheck(transactionId) {
  try {
    const response = await apiCall(`${CONFIG.API_BASE_URL}/fraud/check`, {
      method: 'POST',
      body: {
        transactionId
      }
    });
    
    if (response.success) {
      if (response.fraudCheck.shouldBlock) {
        throw new Error(`Transaction blocked: ${response.fraudCheck.recommendation}`);
      }
      
      if (response.fraudCheck.riskLevel === 'MEDIUM_RISK') {
        document.getElementById('liveness-instruction').textContent = 
          'Medium risk detected - Enhanced verification required';
        await sleep(1500);
      }
    } else {
      throw new Error(response.message || 'Fraud check failed');
    }
  } catch (error) {
    console.error('Fraud check error:', error);
    throw error;
  }
}

// Verify transaction with backend
async function verifyTransaction(transactionId, faceImage, livenessResult) {
  try {
    const response = await apiCall(API.TRANSACTIONS_VERIFY, {
      method: 'POST',
      body: {
        transactionId,
        faceVerified: true, // In production, this would be verified by face matching AI
        livenessScore: livenessResult.livenessScore,
        verificationData: {
          challenges: livenessResult.challenges,
          timestamp: new Date().toISOString()
        }
      }
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Verification failed');
    }
    
    return response.transaction;
  } catch (error) {
    console.error('Transaction verification error:', error);
    throw error;
  }
}

// Helper: sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Close face modal (legacy)
function closeFaceModal() {
  const modal = document.getElementById('face-verification-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Capture face (legacy)
function captureFace() {
  console.log('Capturing face...');
  // Will be implemented with MediaPipe
}

console.log('Face verification module loaded');
