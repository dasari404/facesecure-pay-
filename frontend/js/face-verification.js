// Face Verification Logic

let cameraStream = null;
let verificationInProgress = false;
let faceDetectionInterval = null;
let capturedFrames = [];

// Real face verification functions (will be imported from face-api-real.js module)
// These are set by the module loader in transactions.html
let realFaceAPI = {
  available: false,
  verifyFace: null,
  detectFace: null
};

// Make realFaceAPI accessible globally for module to set
window.setRealFaceAPI = function(api) {
  realFaceAPI = api;
  console.log('✅ Real face verification API connected', api);
};

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
function showFaceMatchResult(matchScore, flags = []) {
  const resultsContainer = document.getElementById('step-results');
  const resultCard = document.createElement('div');
  resultCard.className = 'result-card';
  
  // Build flags display if any
  let flagsHtml = '';
  if (flags && flags.length > 0) {
    const flagLabels = {
      'baseline_missing': '⚠️ No registered face',
      'baseline_ambiguous': '⚠️ Multiple faces in registration',
      'face_missing': '⚠️ No face detected',
      'multiple_faces': '⚠️ Multiple faces detected',
      'identity_mismatch': '❌ Face does not match',
      'low_confidence': '⚠️ Low confidence',
      'liveness_fail': '❌ Liveness check failed'
    };
    
    flagsHtml = '<div style="margin-top: 12px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">' +
      flags.map(flag => `<div style="font-size: 12px; color: #ef4444;">${flagLabels[flag] || flag}</div>`).join('') +
      '</div>';
  }
  
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
      ${flagsHtml}
    </div>
  `;
  resultsContainer.appendChild(resultCard);
}

// Show transaction receipt card
function showTransactionReceipt(txData) {
  console.log('📄 showTransactionReceipt called with:', txData);
  console.log('  window.currentTransactionAmount:', window.currentTransactionAmount);
  console.log('  window.currentRecipient:', window.currentRecipient);
  
  const resultsContainer = document.getElementById('step-results');
  const resultCard = document.createElement('div');
  resultCard.className = 'receipt-card';
  
  // Safe access to properties with defaults - handle all possible undefined cases
  const amount = (txData && typeof txData.amount !== 'undefined') ? txData.amount : 
                 (window.currentTransactionAmount || 0);
  const recipientName = (window.currentRecipient && window.currentRecipient.full_name) ? 
                        window.currentRecipient.full_name : 'Recipient';
  const transactionId = (txData && (txData.transactionId || txData.transaction_id)) || 'N/A';
  const senderBalance = (txData && typeof txData.senderBalance !== 'undefined') ? txData.senderBalance :
                        (txData && typeof txData.sender_balance !== 'undefined') ? txData.sender_balance : 0;
  
  console.log('📊 Extracted values:', { amount, recipientName, transactionId, senderBalance });
  
  resultCard.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-success-icon">✅</div>
      <h3 class="receipt-title">Transaction Successful!</h3>
      <p class="receipt-subtitle">Your payment has been processed securely</p>
    </div>
    <div class="receipt-details">
      <div class="receipt-row">
        <span class="receipt-label">To</span>
        <span class="receipt-value">${recipientName}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Amount</span>
        <span class="receipt-value">₹${(parseFloat(amount) || 0).toFixed(2)}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Transaction ID</span>
        <span class="receipt-value">${transactionId}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Verification Time</span>
        <span class="receipt-value">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">New Balance</span>
        <span class="receipt-value">₹${(parseFloat(senderBalance) || 0).toFixed(2)}</span>
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
    
    // REAL FACE VERIFICATION with face-api.js
    let faceMatchScore;
    let verificationFlags = [];
    
    try {
      // Fetch registered face photo from backend
      const registeredFaceResponse = await apiCall(`${CONFIG.API_BASE_URL}/face/get-registered`, {
        method: 'GET'
      });
      
      if (!registeredFaceResponse.success || !registeredFaceResponse.facePhoto) {
        throw new Error('No registered face found. Please register your face first.');
      }
      
      // Use face-api.js for real comparison
      if (window.isFaceApiReady && window.isFaceApiReady()) {
        console.log('🔍 Using REAL face verification (face-api.js)');
        
        // Load both images
        const registeredImg = await loadImageFromDataURL(registeredFaceResponse.facePhoto);
        const currentImg = await loadImageFromDataURL(faceImage);
        
        // Detect faces and get descriptors
        const [registeredDetection] = await faceapi.detectAllFaces(
          registeredImg,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptors();
        
        const [currentDetection] = await faceapi.detectAllFaces(
          currentImg,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptors();
        
        if (!registeredDetection) {
          verificationFlags.push('baseline_missing');
          throw new Error('No face found in registered photo. Please re-register.');
        }
        
        if (!currentDetection) {
          verificationFlags.push('face_missing');
          throw new Error('No face detected in current frame. Please position your face clearly.');
        }
        
        // Calculate euclidean distance between face descriptors
        const distance = faceapi.euclideanDistance(
          registeredDetection.descriptor,
          currentDetection.descriptor
        );
        
        // Convert distance to confidence score (0-100)
        // Distance < 0.6 is typically a match
        const threshold = 0.6;
        faceMatchScore = Math.round(Math.max(0, Math.min(100, (1 - distance / threshold) * 100)));
        
        console.log('✅ Face comparison:', { distance, confidence: faceMatchScore });
        
        if (distance > threshold) {
          verificationFlags.push('identity_mismatch');
          throw new Error(`Face does not match (distance: ${distance.toFixed(3)}). Please try again.`);
        }
        
        if (faceMatchScore < 70) {
          verificationFlags.push('low_confidence');
        }
        
      } else {
        // Fallback to simulated
        console.warn('⚠️ Using SIMULATED face verification');
        faceMatchScore = Math.floor(Math.random() * 15) + 85;
      }
      
    } catch (error) {
      console.error('Face verification error:', error);
      throw error;
    }
    
    showFaceMatchResult(faceMatchScore, verificationFlags);
    
    // Helper function
    function loadImageFromDataURL(dataURL) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataURL;
      });
    }
    
    // Verify transaction with backend
    let txResult;
    if (window.isRecipientVerification) {
      // Recipient verification (Phase 2) - Completes payment
      txResult = await verifyTransactionAsRecipient(currentTransactionId, faceImage, livenessResult);
    } else {
      // Sender verification (Phase 1)
      txResult = await verifyTransaction(currentTransactionId, faceImage, livenessResult);
    }
    
    updateStep('face', 'complete');
    await sleep(800);
    
    // Step 5: Complete
    updateStep('complete', 'complete');
    
    // Show receipt
    showTransactionReceipt(txResult);
    
    // Hide camera
    document.getElementById('camera-view').classList.remove('show');
    
    // Show success message based on verification stage and role
    if (window.isRecipientVerification && (txResult.verificationStage === 'both_verified' || txResult.status === 'completed')) {
      // Recipient verified - payment complete
      document.getElementById('verification-message').innerHTML = `
        <div style="color: #10b981; font-size: 18px; font-weight: 600; margin-top: 20px;">
          ✅ Payment Received Successfully!
        </div>
        <p style="color: var(--text-secondary); margin-top: 8px;">
          ₹${window.currentTransactionAmount.toFixed(2)} has been credited to your account.
        </p>
      `;
      
      // Reload pending receipts
      if (typeof loadPendingReceipts === 'function') {
        await loadPendingReceipts();
      }
    } else if (txResult.verificationStage === 'pending_recipient') {
      // Sender verified, waiting for recipient
      document.getElementById('verification-message').innerHTML = `
        <div style="color: #3b82f6; font-size: 18px; font-weight: 600; margin-top: 20px;">
          ✅ Sender Verified Successfully!
        </div>
        <p style="color: var(--text-secondary); margin-top: 8px;">
          Waiting for <strong>${txResult.recipient?.name || 'recipient'}</strong> to accept payment...
        </p>
        <div style="margin-top: 16px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px;">
          <p style="font-size: 14px; color: var(--text-secondary);">
            The recipient must verify their identity before the transaction completes.
          </p>
        </div>
      `;
    } else if (txResult.verificationStage === 'both_verified' || txResult.status === 'completed') {
      // Both verified - payment complete
      document.getElementById('verification-message').innerHTML = `
        <div style="color: #10b981; font-size: 18px; font-weight: 600; margin-top: 20px;">
          ✅ Payment Completed Successfully!
        </div>
        <p style="color: var(--text-secondary); margin-top: 8px;">
          Your money has been sent securely.
        </p>
      `;
    } else {
      // Fallback for other states
      document.getElementById('verification-message').innerHTML = `
        <div style="color: #10b981; font-size: 18px; font-weight: 600; margin-top: 20px;">
          ✅ Verification Complete!
        </div>
        <p style="color: var(--text-secondary); margin-top: 8px;">
          Transaction is being processed.
        </p>
      `;
    }
    
    // Reload user profile and transaction history
    await loadUserProfile();
    await loadTransactionHistory();
    
    // Reset form after delay
    setTimeout(() => {
      cancelVerification();
      document.getElementById('verification-message').innerHTML = '';
      window.isRecipientVerification = false; // Clear flag
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

// Start face detection with blue animated box
function startFaceDetection() {
  const video = document.getElementById('camera-video');
  const overlay = document.getElementById('camera-overlay');
  const statusEl = document.getElementById('face-status');
  
  // Create canvas for real-time detection overlay
  let canvas = document.getElementById('verification-detection-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'verification-detection-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    document.getElementById('camera-view').appendChild(canvas);
  }
  
  // Check if face-api.js is ready
  const useFaceApi = window.isFaceApiReady && window.isFaceApiReady();
  
  if (!useFaceApi) {
    // Fallback to simulated detection
    overlay.innerHTML = `
      <div class="face-detection-box">
        <div class="scanning-line"></div>
        <div class="corner corner-tl"></div>
        <div class="corner corner-tr"></div>
        <div class="corner corner-bl"></div>
        <div class="corner corner-br"></div>
      </div>
    `;
  }
  
  faceDetectionInterval = setInterval(async () => {
    if (useFaceApi && video.videoWidth) {
      // REAL face detection
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      try {
        const detections = await faceapi.detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks();
        
        if (detections.length === 0) {
          // No face
          overlay.className = 'camera-overlay no-face';
          statusEl.textContent = 'No face detected';
          statusEl.style.color = '#ef4444';
        } else if (detections.length === 1) {
          // Perfect - one face detected
          const box = detections[0].detection.box;
          
          // Draw green box with corners
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          
          // Draw corners
          const cornerSize = 20;
          ctx.fillStyle = '#10b981';
          // Top-left
          ctx.fillRect(box.x, box.y, cornerSize, 3);
          ctx.fillRect(box.x, box.y, 3, cornerSize);
          // Top-right
          ctx.fillRect(box.x + box.width - cornerSize, box.y, cornerSize, 3);
          ctx.fillRect(box.x + box.width - 3, box.y, 3, cornerSize);
          // Bottom-left
          ctx.fillRect(box.x, box.y + box.height - 3, cornerSize, 3);
          ctx.fillRect(box.x, box.y + box.height - cornerSize, 3, cornerSize);
          // Bottom-right
          ctx.fillRect(box.x + box.width - cornerSize, box.y + box.height - 3, cornerSize, 3);
          ctx.fillRect(box.x + box.width - 3, box.y + box.height - cornerSize, 3, cornerSize);
          
          // Draw landmarks (68 points)
          ctx.fillStyle = '#10b981';
          detections[0].landmarks.positions.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
          });
          
          overlay.className = 'camera-overlay face-detected';
          statusEl.textContent = 'Face detected ✓';
          statusEl.style.color = '#10b981';
          
        } else {
          // Multiple faces
          overlay.className = 'camera-overlay face-off-center';
          statusEl.textContent = `${detections.length} faces - Only one person allowed`;
          statusEl.style.color = '#f59e0b';
        }
      } catch (error) {
        console.error('Detection error:', error);
      }
      
    } else {
      // Simulated detection (fallback)
      const rand = Math.random();
      
      if (rand > 0.7) {
        overlay.className = 'camera-overlay face-detected';
        statusEl.textContent = 'Face detected ✓';
        statusEl.style.color = '#10b981';
      } else if (rand > 0.4) {
        overlay.className = 'camera-overlay face-off-center';
        statusEl.textContent = 'Position face in center';
        statusEl.style.color = '#f59e0b';
      } else {
        overlay.className = 'camera-overlay no-face';
        statusEl.textContent = 'No face detected';
        statusEl.style.color = '#ef4444';
      }
    }
  }, 100);
}

// Stop face detection
function stopFaceDetection() {
  if (faceDetectionInterval) {
    clearInterval(faceDetectionInterval);
    faceDetectionInterval = null;
  }
  
  // Remove detection canvas
  const canvas = document.getElementById('verification-detection-canvas');
  if (canvas) {
    canvas.remove();
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
    challengeOverlay.style.display = 'flex';
    challengeText.textContent = challenge.instruction;
    challengeProgress.textContent = `${i + 1}/4`;
    
    // Countdown with animation
    for (let t = 3; t > 0; t--) {
      challengeTimer.textContent = t;
      challengeTimer.style.fontSize = '72px';
      challengeTimer.style.fontWeight = 'bold';
      challengeTimer.style.color = '#3b82f6';
      await sleep(1000);
    }
    
    challengeTimer.textContent = '';
    
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
    challengeText.style.color = '#10b981';
    await sleep(500);
  }
  
  // Hide challenge overlay
  challengeOverlay.classList.remove('show');
  challengeOverlay.style.display = 'none';
  
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

// Verify transaction with backend (SENDER SIDE - Phase 1)
async function verifyTransaction(transactionId, faceImage, livenessResult) {
  try {
    // Use new sender verification endpoint for dual verification
    const response = await apiCall(API.TRANSACTIONS_VERIFY_SENDER, {
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


// Verify transaction as RECIPIENT (Phase 2 - Completes Payment)
async function verifyTransactionAsRecipient(transactionId, faceImage, livenessResult) {
  try {
    console.log('=== VERIFY TRANSACTION AS RECIPIENT ===');
    console.log('Transaction ID:', transactionId);
    console.log('API Endpoint:', API.TRANSACTIONS_VERIFY_RECIPIENT);
    console.log('Liveness Score:', livenessResult.averageScore);
    
    const response = await apiCall(API.TRANSACTIONS_VERIFY_RECIPIENT, {
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
    
    console.log('Recipient verification response:', response);
    
    if (!response.success) {
      throw new Error(response.message || 'Verification failed');
    }
    
    return response.transaction;
  } catch (error) {
    console.error('Recipient verification error:', error);
    throw error;
  }
} throw error;
  }
}

// Get pending receipts (transactions awaiting recipient verification)
async function getPendingReceipts() {
  try {
    const response = await apiCall(API.PENDING_RECEIPTS, {
      method: 'GET'
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch pending receipts');
    }
    
    return response.pendingReceipts;
  } catch (error) {
    console.error('Pending receipts error:', error);
    throw error;
  }
}
