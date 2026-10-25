// Face Verification Logic

let cameraStream = null;
let verificationInProgress = false;
let faceDetectionInterval = null;
let capturedFrames = [];

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
  
  // Update progress bar
  const steps = ['recipient', 'fraud', 'liveness', 'face', 'complete'];
  const currentIndex = steps.indexOf(stepName);
  if (currentIndex >= 0 && status === 'complete') {
    const progress = ((currentIndex + 1) / steps.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
  }
}

// Show recipient result card
function showRecipientResult(recipientData) {
  const resultsContainer = document.getElementById('step-results');
  const resultCard = document.createElement('div');
  resultCard.className = 'result-card';
  resultCard.innerHTML = `
    <div class="result-card-header">
      <span class="result-icon">✅</span>
      <h4 class="result-title">Recipient Verified</h4>
    </div>
    <div class="result-content">
      <p style="color: var(--text-primary); font-weight: 600;">${recipientData.full_name}</p>
      <p style="color: var(--text-secondary); font-size: 14px;">${recipientData.email}</p>
    </div>
  `;
  resultsContainer.appendChild(resultCard);
}

// Show fraud check result card
function showFraudResult(fraudData) {
  const resultsContainer = document.getElementById('step-results');
  const resultCard = document.createElement('div');
  resultCard.className = 'result-card';
  
  const riskColor = {
    'LOW_RISK': '#10b981',
    'MEDIUM_RISK': '#f59e0b',
    'HIGH_RISK': '#ef4444'
  }[fraudData.riskLevel] || '#6366f1';
  
  // Build risk factors list
  let riskFactors = '';
  if (fraudData.details && fraudData.details.reasons) {
    riskFactors = '<ul class="risk-breakdown">' + 
      fraudData.details.reasons.map(reason => `<li>${reason}</li>`).join('') +
      '</ul>';
  }
  
  resultCard.innerHTML = `
    <div class="result-card-header">
      <span class="result-icon">🛡️</span>
      <h4 class="result-title">Fraud Screening Complete</h4>
    </div>
    <div class="result-content">
      <div class="risk-badge ${fraudData.riskLevel}">${fraudData.riskLevel.replace('_', ' ')}</div>
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">
        Fraud Score: <strong style="color: ${riskColor};">${fraudData.fraudScore}/100</strong>
      </p>
      ${riskFactors}
      ${fraudData.shouldBlock ? `<p style="color: #ef4444; margin-top: 12px; font-weight: 600;">⚠️ Transaction blocked: ${fraudData.recommendation}</p>` : ''}
    </div>
  `;
  resultsContainer.appendChild(resultCard);
}

// Show liveness result card
function showLivenessResult(livenessData) {
  const resultsContainer = document.getElementById('step-results');
  const resultCard = document.createElement('div');
  resultCard.className = 'result-card';
  
  // Build challenges grid
  const challengesHtml = livenessData.challenges.map((ch, index) => `
    <div class="challenge-item">
      <span class="challenge-icon">${ch.icon}</span>
      <div class="challenge-info">
        <div class="challenge-name">${ch.name}</div>
        <div class="challenge-score">Score: ${ch.score}/100</div>
      </div>
      <span class="challenge-status">${ch.score >= 60 ? '✓' : '❌'}</span>
    </div>
  `).join('');
  
  resultCard.innerHTML = `
    <div class="result-card-header">
      <span class="result-icon">👁️</span>
      <h4 class="result-title">Liveness Detection Complete</h4>
    </div>
    <div class="result-content">
      <div class="score-display">
        <div class="score-circle" style="--score: ${livenessData.averageScore}">
          <span class="score-value">${livenessData.averageScore}</span>
        </div>
        <div>
          <p style="color: var(--text-primary); font-weight: 600;">Liveness Score</p>
          <p style="color: var(--text-secondary); font-size: 14px;">
            ${livenessData.averageScore >= CONFIG.LIVENESS_THRESHOLD ? 'Passed ✓' : 'Failed ❌'}
          </p>
        </div>
      </div>
      <div class="challenge-grid">
        ${challengesHtml}
      </div>
    </div>
  `;
  resultsContainer.appendChild(resultCard);
}

// Show face match result card
function showFaceMatchResult(matchScore) {
  const resultsContainer = document.getElementById('step-results');
  const resultCard = document.createElement('div');
  resultCard.className = 'result-card';
  
  resultCard.innerHTML = `
    <div class="result-card-header">
      <span class="result-icon">🔍</span>
      <h4 class="result-title">Face Verification Complete</h4>
    </div>
    <div class="result-content">
      <div class="score-display">
        <div class="score-circle" style="--score: ${matchScore}">
          <span class="score-value">${matchScore}%</span>
        </div>
        <div>
          <p style="color: var(--text-primary); font-weight: 600;">Face Match</p>
          <p style="color: var(--text-secondary); font-size: 14px;">
            ${matchScore >= 80 ? 'Match Confirmed ✓' : 'Match Failed ❌'}
          </p>
        </div>
      </div>
      <p style="color: var(--text-secondary); font-size: 14px; margin-top: 12px;">
        Your face matches the registered profile with ${matchScore}% confidence.
      </p>
    </div>
  `;
  resultsContainer.appendChild(resultCard);
}

// Show transaction receipt card
function showTransactionReceipt(txData) {
  const resultsContainer = document.getElementById('step-results');
  const resultCard = document.createElement('div');
  resultCard.className = 'receipt-card';
  
  resultCard.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-success-icon">✅</div>
      <h3 class="receipt-title">Transaction Successful!</h3>
      <p class="receipt-subtitle">Your payment has been processed securely</p>
    </div>
    <div class="receipt-details">
      <div class="receipt-row">
        <span class="receipt-label">To</span>
        <span class="receipt-value">${window.currentRecipient?.full_name || 'Recipient'}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Amount</span>
        <span class="receipt-value">₹${txData.amount.toFixed(2)}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Transaction ID</span>
        <span class="receipt-value">${txData.transactionId}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Verification Time</span>
        <span class="receipt-value">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">New Balance</span>
        <span class="receipt-value">₹${txData.senderBalance.toFixed(2)}</span>
      </div>
    </div>
  `;
  resultsContainer.appendChild(resultCard);
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
    // Clear previous results
    document.getElementById('step-results').innerHTML = '';
    document.getElementById('captured-frames').innerHTML = '';
    capturedFrames = [];
    
    // Hide start button
    document.getElementById('start-verification-btn').style.display = 'none';
    
    // Step 1: Recipient Validation
    updateStep('recipient', 'active');
    await sleep(1000);
    
    if (window.currentRecipient) {
      showRecipientResult(window.currentRecipient);
    }
    updateStep('recipient', 'complete');
    await sleep(800);
    
    // Step 2: Fraud Check
    updateStep('fraud', 'active');
    document.getElementById('liveness-instruction').textContent = 'Running fraud detection...';
    
    const fraudResult = await runFraudCheck(currentTransactionId);
    showFraudResult(fraudResult);
    
    if (fraudResult.shouldBlock) {
      throw new Error(`Transaction blocked: ${fraudResult.recommendation}`);
    }
    
    updateStep('fraud', 'complete');
    await sleep(1500);
    
    // Step 3: Initialize Camera and Liveness
    updateStep('liveness', 'active');
    document.getElementById('camera-view').classList.add('show');
    document.getElementById('liveness-instruction').textContent = 'Initializing camera...';
    
    await initializeCamera();
    
    // Run face detection
    startFaceDetection();
    
    // Run liveness challenges
    const livenessResult = await runLivenessChallenges();
    
    // Stop face detection
    stopFaceDetection();
    
    showLivenessResult(livenessResult);
    
    updateStep('liveness', 'complete');
    await sleep(800);
    
    // Step 4: Face Verification
    updateStep('face', 'active');
    document.getElementById('liveness-instruction').textContent = 'Verifying your face...';
    
    const faceImage = captureFrame();
    const faceMatchScore = Math.floor(Math.random() * 15) + 85; // 85-100 (mock)
    
    showFaceMatchResult(faceMatchScore);
    
    // Verify transaction with backend
    const txResult = await verifyTransaction(currentTransactionId, faceImage, livenessResult);
    
    updateStep('face', 'complete');
    await sleep(800);
    
    // Step 5: Complete
    updateStep('complete', 'complete');
    
    // Show receipt
    showTransactionReceipt(txResult);
    
    // Hide camera
    document.getElementById('camera-view').classList.remove('show');
    
    // Show success message
    document.getElementById('verification-message').innerHTML = `
      <div style="color: #10b981; font-size: 18px; font-weight: 600; margin-top: 20px;">
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
    }, 4000);
    
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
    
    document.getElementById('start-verification-btn').style.display = 'inline-flex';
    document.getElementById('camera-view').classList.remove('show');
  } finally {
    verificationInProgress = false;
    
    // Stop camera
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    
    stopFaceDetection();
  }
}

// Initialize camera
async function initializeCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
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

// Start face detection (simulated)
function startFaceDetection() {
  const overlay = document.getElementById('camera-overlay');
  const statusEl = document.getElementById('face-status');
  
  faceDetectionInterval = setInterval(() => {
    // Simulate face detection (random for demo)
    const rand = Math.random();
    
    if (rand > 0.7) {
      // Face detected
      overlay.className = 'camera-overlay face-detected';
      statusEl.textContent = 'Face detected ✓';
      statusEl.style.color = '#10b981';
    } else if (rand > 0.4) {
      // Face off-center
      overlay.className = 'camera-overlay face-off-center';
      statusEl.textContent = 'Position face in center';
      statusEl.style.color = '#f59e0b';
    } else {
      // No face
      overlay.className = 'camera-overlay no-face';
      statusEl.textContent = 'Face not detected';
      statusEl.style.color = '#ef4444';
    }
  }, 500);
}

// Stop face detection
function stopFaceDetection() {
  if (faceDetectionInterval) {
    clearInterval(faceDetectionInterval);
    faceDetectionInterval = null;
  }
}

// Run liveness challenges sequentially
async function runLivenessChallenges() {
  const challenges = [
    { id: 'blink', name: 'Blink Detection', instruction: 'Please blink your eyes naturally', icon: '👁️', duration: 3000 },
    { id: 'turn_left', name: 'Turn Head Left', instruction: 'Slowly turn your head to the left', icon: '⬅️', duration: 3000 },
    { id: 'turn_right', name: 'Turn Head Right', instruction: 'Slowly turn your head to the right', icon: '➡️', duration: 3000 },
    { id: 'smile', name: 'Smile Detection', instruction: 'Please smile naturally', icon: '😊', duration: 2500 }
  ];
  
  const challengeOverlay = document.getElementById('challenge-overlay');
  const challengeText = document.getElementById('challenge-text');
  const challengeProgress = document.getElementById('challenge-progress');
  const challengeTimer = document.getElementById('challenge-timer');
  
  const results = [];
  
  for (let i = 0; i < challenges.length; i++) {
    const challenge = challenges[i];
    
    // Show challenge overlay
    challengeOverlay.classList.add('show');
    challengeText.textContent = challenge.instruction;
    challengeProgress.textContent = `${i + 1}/4`;
    
    // Countdown
    for (let t = 3; t > 0; t--) {
      challengeTimer.textContent = t;
      await sleep(1000);
    }
    
    // Capture frame
    const frame = captureFrame();
    capturedFrames.push({ challenge: challenge.name, image: frame });
    
    // Simulate challenge score
    const score = Math.floor(Math.random() * 25) + 70; // 70-95
    
    results.push({
      id: challenge.id,
      name: challenge.name,
      icon: challenge.icon,
      score: score,
      passed: score >= 60
    });
    
    // Show checkmark
    challengeText.textContent = '✓ Challenge Complete';
    await sleep(500);
  }
  
  // Hide challenge overlay
  challengeOverlay.classList.remove('show');
  
  // Display captured frames
  displayCapturedFrames();
  
  // Calculate average score
  const averageScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  
  return {
    challenges: results,
    averageScore: averageScore,
    passed: averageScore >= CONFIG.LIVENESS_THRESHOLD
  };
}

// Display captured frames
function displayCapturedFrames() {
  const container = document.getElementById('captured-frames');
  container.innerHTML = capturedFrames.map((item, index) => `
    <div class="captured-frame">
      <img src="${item.image}" alt="${item.challenge}">
      <div class="frame-label">${item.challenge}</div>
    </div>
  `).join('');
}

// Capture frame from video
function captureFrame() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  return canvas.toDataURL('image/jpeg', 0.8);
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
      return response.fraudCheck;
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
        faceVerified: true,
        livenessScore: livenessResult.averageScore,
        verificationData: {
          challenges: livenessResult.challenges.map(c => c.id),
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

console.log('Face verification module loaded');
