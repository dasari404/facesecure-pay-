// Transactions Logic

let currentTransactionId = null;
let recipientSearchTimeout = null;
let validatedRecipient = null; // Store validated recipient data

// Load user profile and balance
async function loadUserProfile() {
  try {
    const response = await apiCall(API.GET_USER_PROFILE, {
      method: 'GET'
    });
    
    if (response.success) {
      const user = response.user;
      
      // Update sidebar user info
      document.getElementById('user-name').textContent = user.full_name;
      document.getElementById('user-email').textContent = user.email;
      document.getElementById('sidebar-balance').textContent = user.balance.toFixed(2);
      
      // Update payment number display
      const paymentNumberEl = document.getElementById('payment-number-value');
      if (paymentNumberEl && user.payment_number) {
        paymentNumberEl.textContent = user.payment_number;
        
        // Add copy functionality
        const copyBtn = document.getElementById('copy-payment-number');
        if (copyBtn) {
          copyBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(user.payment_number).then(() => {
              copyBtn.textContent = '✓';
              setTimeout(() => {
                copyBtn.textContent = '📋';
              }, 2000);
            }).catch(err => {
              console.error('Failed to copy:', err);
            });
          });
        }
      }
      
      // Update avatar with first letter of name
      const avatarEl = document.getElementById('user-avatar');
      if (avatarEl) {
        avatarEl.textContent = user.full_name.charAt(0).toUpperCase();
      }
      
      // Show face registration warning if not registered
      const faceStatusWidget = document.getElementById('face-status-widget');
      if (faceStatusWidget) {
        if (user.face_registered === 1 || user.face_registered === true) {
          faceStatusWidget.style.display = 'none';
        } else {
          faceStatusWidget.style.display = 'block';
        }
      }
      
      return user;
    } else {
      throw new Error(response.message || 'Failed to load profile');
    }
  } catch (error) {
    console.error('Profile load error:', error);
    showAlert('register-error', 'Failed to load profile', 'error');
    
    // If auth error, redirect to login
    if (error.message && (error.message.includes('token') || error.message.includes('No token'))) {
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    }
  }
}

// Load transaction history
async function loadTransactionHistory() {
  try {
    const response = await apiCall(API.GET_TRANSACTIONS + '?limit=10', {
      method: 'GET'
    });
    
    if (response.success) {
      displayTransactions(response.transactions);
    } else {
      throw new Error(response.message || 'Failed to load transactions');
    }
  } catch (error) {
    console.error('Transaction history load error:', error);
  }
}

// Display transactions in the list
function displayTransactions(transactions) {
  const listEl = document.getElementById('transaction-list');
  
  if (!transactions || transactions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">💳</div>
        <p>No transactions yet</p>
        <small>Your transaction history will appear here</small>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = transactions.map(tx => {
    const isSent = tx.type === 'sent';
    const iconClass = isSent ? 'sent' : 'received';
    const icon = isSent ? '↗️' : '↙️';
    const amountClass = isSent ? 'sent' : 'received';
    const amountPrefix = isSent ? '-' : '+';
    const otherParty = isSent ? tx.recipient.name : tx.sender.name;
    const statusClass = tx.status;
    
    // Determine if transaction is clickable (pending SENT transaction)
    const isClickable = isSent && tx.status === 'pending';
    const clickableClass = isClickable ? 'transaction-clickable' : '';
    const clickHandler = isClickable ? `onclick="handleTransactionClick('${tx.transactionId}', ${tx.amount}, '${otherParty.replace(/'/g, "\\'")}')"` : '';
    
    return `
      <div class="transaction-item ${clickableClass}" ${clickHandler}>
        <div class="transaction-left">
          <div class="transaction-icon ${iconClass}">${icon}</div>
          <div class="transaction-details">
            <h4>${isSent ? 'Sent to' : 'Received from'} ${otherParty}</h4>
            <p>${formatDate(tx.createdAt)}</p>
            ${isClickable ? '<small style="color: #f59e0b;">⚠️ Click to complete verification</small>' : ''}
          </div>
        </div>
        <div class="transaction-right">
          <div class="transaction-amount ${amountClass}">
            ${amountPrefix}${formatCurrency(tx.amount)}
          </div>
          <span class="transaction-status ${statusClass}">${tx.status}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Handle clicking on a pending transaction to complete verification
async function handleTransactionClick(transactionId, amount, recipientName) {
  console.log('=== TRANSACTION CLICKED ===');
  console.log('Transaction ID:', transactionId);
  console.log('Amount:', amount);
  console.log('Recipient:', recipientName);
  
  // Store transaction data globally for verification module
  currentTransactionId = transactionId;
  window.currentRecipient = { full_name: recipientName };
  window.currentTransactionAmount = amount;
  window.isRecipientVerification = false; // This is sender continuing their verification
  
  console.log('Set currentTransactionId:', currentTransactionId);
  
  // Show send money section
  showSection('send-money');
  
  // Hide the form, show only verification
  const form = document.getElementById('send-money-form');
  if (form) {
    form.style.display = 'none';
  }
  
  // Update page header for context
  const pageTitle = document.querySelector('#send-money-section .page-title');
  const pageSubtitle = document.querySelector('#send-money-section .page-subtitle');
  if (pageTitle) {
    pageTitle.textContent = 'Complete Verification';
  }
  if (pageSubtitle) {
    pageSubtitle.textContent = `Complete face verification to send ₹${amount.toFixed(2)} to ${recipientName}`;
  }
  
  // Show verification section immediately
  const verificationSection = document.getElementById('verification-section');
  if (verificationSection) {
    verificationSection.classList.add('show');
    verificationSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// Search for recipient by payment number (with validation)
function searchRecipient(paymentNumber) {
  const inputEl = document.getElementById('recipient-email');
  const loadingEl = document.getElementById('search-loading');
  const errorEl = document.getElementById('recipient-error');
  const foundEl = document.getElementById('recipient-found');
  
  // Clear previous timeout
  if (recipientSearchTimeout) {
    clearTimeout(recipientSearchTimeout);
  }
  
  // Reset validation state
  validatedRecipient = null;
  inputEl.classList.remove('input-valid', 'input-invalid');
  loadingEl.classList.remove('show');
  errorEl.classList.remove('show');
  foundEl.classList.remove('show');
  
  // Validate payment number format (exactly 10 digits)
  if (!paymentNumber || paymentNumber.length === 0) {
    return;
  }
  
  // Check if it's not all digits
  if (!/^\d+$/.test(paymentNumber)) {
    inputEl.classList.add('input-invalid');
    errorEl.textContent = '❌ Payment number must contain only digits';
    errorEl.classList.add('show');
    return;
  }
  
  // Check length
  if (paymentNumber.length < 10) {
    return; // Wait for more input
  }
  
  if (paymentNumber.length > 10) {
    inputEl.classList.add('input-invalid');
    errorEl.textContent = '❌ Payment number must be exactly 10 digits';
    errorEl.classList.add('show');
    return;
  }
  
  // Show loading indicator
  loadingEl.classList.add('show');
  
  // Debounce search
  recipientSearchTimeout = setTimeout(async () => {
    try {
      const response = await apiCall(API.GET_PAYMENT_NUMBER_USER + `?number=${encodeURIComponent(paymentNumber)}`, {
        method: 'GET'
      });
      
      loadingEl.classList.remove('show');
      
      if (response.success && response.user) {
        const user = response.user;
        validatedRecipient = user;
        
        // Show success state
        inputEl.classList.add('input-valid');
        document.getElementById('recipient-name').textContent = `${user.full_name} (@${user.username})`;
        document.getElementById('recipient-id').textContent = user.email;
        
        // Update avatar with first letter
        const avatarEl = document.getElementById('recipient-avatar');
        avatarEl.textContent = user.full_name.charAt(0).toUpperCase();
        
        foundEl.classList.add('show');
      } else {
        // Show error state
        inputEl.classList.add('input-invalid');
        errorEl.textContent = '❌ Payment number not found';
        errorEl.classList.add('show');
      }
    } catch (error) {
      console.error('Recipient search error:', error);
      loadingEl.classList.remove('show');
      inputEl.classList.add('input-invalid');
      errorEl.textContent = '❌ Payment number not found';
      errorEl.classList.add('show');
    }
  }, 500);
}

// Handle send money form submission
async function handleSendMoneySubmit(event) {
  event.preventDefault();
  
  const paymentNumber = document.getElementById('recipient-email').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const description = document.getElementById('description').value;
  const transactionType = document.getElementById('transaction-type').value;
  const inputEl = document.getElementById('recipient-email');
  
  // Validate recipient before submission
  if (!validatedRecipient) {
    // Show error animation
    inputEl.classList.add('shake');
    setTimeout(() => inputEl.classList.remove('shake'), 500);
    
    alert('Please enter a valid 10-digit payment number.');
    return;
  }
  
  try {
    const response = await apiCall(API.SEND_MONEY, {
      method: 'POST',
      body: {
        recipientIdentifier: paymentNumber,
        amount,
        description,
        transactionType
      }
    });
    
    if (response.success) {
      // Store transaction ID and recipient data
      currentTransactionId = response.transactionId;
      window.currentRecipient = validatedRecipient; // Make available to verification module
      window.currentTransactionAmount = amount;
      
      // Show verification section
      document.getElementById('verification-section').classList.add('show');
      
      // Scroll to verification
      document.getElementById('verification-section').scrollIntoView({ behavior: 'smooth' });
    } else {
      throw new Error(response.message || 'Transaction failed');
    }
  } catch (error) {
    console.error('Send money error:', error);
    alert(error.message || 'Failed to create transaction. Please try again.');
  }
}

// Cancel verification
function cancelVerification() {
  currentTransactionId = null;
  validatedRecipient = null;
  window.currentRecipient = null;
  window.currentTransactionAmount = null;
  
  document.getElementById('verification-section').classList.remove('show');
  document.getElementById('camera-view').classList.remove('show');
  document.getElementById('send-money-form').reset();
  document.getElementById('recipient-found').classList.remove('show');
  document.getElementById('recipient-error').classList.remove('show');
  document.getElementById('search-loading').classList.remove('show');
  document.getElementById('recipient-email').classList.remove('input-valid', 'input-invalid');
  
  // Clear step results
  document.getElementById('step-results').innerHTML = '';
  document.getElementById('captured-frames').innerHTML = '';
  
  // Reset progress
  document.getElementById('progress-fill').style.width = '0%';
  
  // Stop camera if running
  const video = document.getElementById('camera-video');
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

// Show add money (placeholder)
function showAddMoney() {
  alert('Add money feature coming soon!');
}

// Load pending receipts (transactions waiting for recipient verification)
async function loadPendingReceipts() {
  try {
    console.log('=== LOADING PENDING RECEIPTS ===');
    console.log('API Endpoint:', API.TRANSACTIONS_PENDING_RECEIPTS);
    
    const response = await apiCall(API.TRANSACTIONS_PENDING_RECEIPTS, {
      method: 'GET'
    });
    
    console.log('Pending receipts response:', response);
    
    if (response.success) {
      displayPendingReceipts(response.transactions || []);
      updatePendingBadge(response.transactions ? response.transactions.length : 0);
    } else {
      throw new Error(response.message || 'Failed to load pending receipts');
    }
  } catch (error) {
    console.error('Pending receipts load error:', error);
  }
}

// Display pending receipts
function displayPendingReceipts(transactions) {
  const listEl = document.getElementById('pending-list');
  
  if (!transactions || transactions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">✅</div>
        <p>No pending receipts</p>
        <small>When someone sends you money, it will appear here for verification</small>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = transactions.map(tx => {
    const senderName = tx.sender_name || 'Unknown';
    const amount = tx.amount || 0;
    const createdAt = tx.created_at || new Date().toISOString();
    
    return `
      <div class="transaction-item" style="border-left: 3px solid #f59e0b;">
        <div class="transaction-left">
          <div class="transaction-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">⏳</div>
          <div class="transaction-details">
            <h4>Payment from ${senderName}</h4>
            <p>Waiting for your verification • ${formatDate(createdAt)}</p>
          </div>
        </div>
        <div class="transaction-right">
          <div class="transaction-amount" style="color: #10b981;">+${formatCurrency(amount)}</div>
          <button class="btn btn-primary" style="padding: 8px 16px; font-size: 14px;" onclick="verifyReceipt('${tx.transaction_id}', ${amount}, '${senderName}')">
            Verify Now
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Update pending badge count
function updatePendingBadge(count) {
  const badge = document.getElementById('pending-badge');
  const countBadge = document.getElementById('pending-count-badge');
  
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
  
  if (countBadge) {
    countBadge.textContent = `${count} Pending`;
  }
}

// Start verification for received payment
async function verifyReceipt(transactionId, amount, senderName) {
  console.log('=== VERIFY RECEIPT CALLED ===');
  console.log('Transaction ID:', transactionId);
  console.log('Amount:', amount);
  console.log('Sender Name:', senderName);
  
  // Store transaction data
  currentTransactionId = transactionId;
  window.currentRecipient = { full_name: senderName }; // For display purposes
  window.currentTransactionAmount = amount;
  window.isRecipientVerification = true; // Flag to distinguish from sender verification
  
  console.log('Stored currentTransactionId:', currentTransactionId);
  console.log('Set isRecipientVerification:', window.isRecipientVerification);
  
  // Show send money section with verification
  showSection('send-money');
  
  // Show verification section immediately
  document.getElementById('verification-section').classList.add('show');
  
  // Hide the form, show only verification
  const form = document.getElementById('send-money-form');
  if (form) {
    form.style.display = 'none';
  }
  
  // Update page header for context
  const pageTitle = document.querySelector('#send-money-section .page-title');
  const pageSubtitle = document.querySelector('#send-money-section .page-subtitle');
  if (pageTitle) {
    pageTitle.textContent = 'Verify Receipt';
  }
  if (pageSubtitle) {
    pageSubtitle.textContent = `Complete face verification to receive ₹${amount.toFixed(2)} from ${senderName}`;
  }
  
  // Scroll to verification
  document.getElementById('verification-section').scrollIntoView({ behavior: 'smooth' });
}

// Section navigation
function showSection(sectionName) {
  // Hide all sections
  document.getElementById('send-money-section').style.display = 'none';
  document.getElementById('history-section').style.display = 'none';
  document.getElementById('pending-receipts-section').style.display = 'none';
  
  // Show selected section
  if (sectionName === 'send-money') {
    document.getElementById('send-money-section').style.display = 'block';
  } else if (sectionName === 'history') {
    document.getElementById('history-section').style.display = 'block';
    loadTransactionHistory(); // Reload transaction history when viewing
  } else if (sectionName === 'pending-receipts') {
    document.getElementById('pending-receipts-section').style.display = 'block';
  }
  
  // Update active nav link
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`.sidebar-nav a[href="#${sectionName}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

// Show full transaction history section
function showFullHistory() {
  showSection('history');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
  // Check authentication
  if (!checkAuth()) {
    return;
  }
  
  // Load user profile and transactions
  await loadUserProfile();
  await loadTransactionHistory();
  await loadPendingReceipts(); // Load pending receipts
  
  // Setup send money form
  const sendMoneyForm = document.getElementById('send-money-form');
  if (sendMoneyForm) {
    sendMoneyForm.addEventListener('submit', handleSendMoneySubmit);
  }
  
  // Setup recipient search
  const recipientInput = document.getElementById('recipient-email');
  if (recipientInput) {
    recipientInput.addEventListener('input', function() {
      searchRecipient(this.value);
    });
  }
  
  // Setup navigation links
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      
      if (href === '#send-money') {
        showSection('send-money');
        // Reset the form visibility
        const form = document.getElementById('send-money-form');
        if (form) {
          form.style.display = 'flex';
        }
        // Reset page header
        const pageTitle = document.querySelector('#send-money-section .page-title');
        const pageSubtitle = document.querySelector('#send-money-section .page-subtitle');
        if (pageTitle) {
          pageTitle.textContent = 'Send Money';
        }
        if (pageSubtitle) {
          pageSubtitle.textContent = 'Transfer funds securely with face verification';
        }
      } else if (href === '#history') {
        showSection('history');
        loadTransactionHistory(); // Refresh history
      } else if (href === '#pending-receipts') {
        showSection('pending-receipts');
        loadPendingReceipts(); // Refresh pending receipts
      }
    });
  });
  
  // Auto-refresh pending receipts every 30 seconds
  setInterval(() => {
    loadPendingReceipts();
  }, 30000);
});

console.log('Transactions module loaded');


// Face Registration Modal Functions
let regVideoStream = null;
let capturedFacePhoto = null;

async function openFaceRegistrationModal() {
  const modal = document.getElementById('face-registration-modal');
  modal.style.display = 'flex';
  
  // Start camera
  try {
    regVideoStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, facingMode: 'user' } 
    });
    document.getElementById('reg-camera-video').srcObject = regVideoStream;
    document.getElementById('reg-face-status').textContent = 'Position your face in the oval';
    document.getElementById('reg-face-status').style.color = '#3b82f6';
  } catch (error) {
    console.error('Camera error:', error);
    document.getElementById('reg-face-status').textContent = 'Camera access denied';
    document.getElementById('reg-face-status').style.color = '#ef4444';
  }
}

function closeFaceRegistrationModal() {
  const modal = document.getElementById('face-registration-modal');
  modal.style.display = 'none';
  
  // Stop camera
  if (regVideoStream) {
    regVideoStream.getTracks().forEach(track => track.stop());
    regVideoStream = null;
  }
  
  // Reset UI
  document.getElementById('reg-camera-container').style.display = 'block';
  document.getElementById('reg-photo-preview').style.display = 'none';
  document.getElementById('reg-capture-btn').style.display = 'inline-flex';
  document.getElementById('reg-retake-btn').style.display = 'none';
  document.getElementById('reg-save-btn').style.display = 'none';
  document.getElementById('reg-message').style.display = 'none';
  capturedFacePhoto = null;
}

function captureFacePhoto() {
  const video = document.getElementById('reg-camera-video');
  const canvas = document.getElementById('reg-camera-canvas');
  const preview = document.getElementById('reg-photo-img');
  
  // Set canvas size to match video
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  
  // Draw current frame
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Get image data
  capturedFacePhoto = canvas.toDataURL('image/jpeg', 0.9);
  
  // Show preview
  preview.src = capturedFacePhoto;
  document.getElementById('reg-camera-container').style.display = 'none';
  document.getElementById('reg-photo-preview').style.display = 'block';
  
  // Update buttons
  document.getElementById('reg-capture-btn').style.display = 'none';
  document.getElementById('reg-retake-btn').style.display = 'inline-flex';
  document.getElementById('reg-save-btn').style.display = 'inline-flex';
  
  // Stop camera
  if (regVideoStream) {
    regVideoStream.getTracks().forEach(track => track.stop());
    regVideoStream = null;
  }
}

async function retakeFacePhoto() {
  // Show camera again
  document.getElementById('reg-camera-container').style.display = 'block';
  document.getElementById('reg-photo-preview').style.display = 'none';
  document.getElementById('reg-capture-btn').style.display = 'inline-flex';
  document.getElementById('reg-retake-btn').style.display = 'none';
  document.getElementById('reg-save-btn').style.display = 'none';
  capturedFacePhoto = null;
  
  // Restart camera
  try {
    regVideoStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, facingMode: 'user' } 
    });
    document.getElementById('reg-camera-video').srcObject = regVideoStream;
  } catch (error) {
    console.error('Camera restart error:', error);
  }
}

async function saveFaceRegistration() {
  if (!capturedFacePhoto) {
    showRegMessage('Please capture a photo first', 'error');
    return;
  }
  
  const saveBtn = document.getElementById('reg-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  try {
    const response = await apiCall(API.FACE_REGISTER, {
      method: 'POST',
      body: {
        facePhoto: capturedFacePhoto
      }
    });
    
    if (response.success) {
      showRegMessage('✅ Face registered successfully!', 'success');
      
      // Hide warning widget
      const faceStatusWidget = document.getElementById('face-status-widget');
      if (faceStatusWidget) {
        faceStatusWidget.style.display = 'none';
      }
      
      // Close modal after 2 seconds
      setTimeout(() => {
        closeFaceRegistrationModal();
      }, 2000);
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  } catch (error) {
    console.error('Face registration error:', error);
    showRegMessage('❌ ' + (error.message || 'Failed to register face. Please try again.'), 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = '✅ Save & Register';
  }
}

function showRegMessage(message, type) {
  const msgEl = document.getElementById('reg-message');
  msgEl.textContent = message;
  msgEl.style.display = 'block';
  
  if (type === 'success') {
    msgEl.style.background = 'rgba(16, 185, 129, 0.1)';
    msgEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    msgEl.style.color = '#10b981';
  } else {
    msgEl.style.background = 'rgba(239, 68, 68, 0.1)';
    msgEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    msgEl.style.color = '#ef4444';
  }
}


// ========================
// Face Registration Modal
// ========================

let regCameraStream = null;
let capturedFaceData = null;

// Open face registration modal
function openFaceRegistrationModal() {
  const modal = document.getElementById('face-registration-modal');
  modal.style.display = 'flex';
  
  // Reset state
  capturedFaceData = null;
  document.getElementById('reg-photo-preview').style.display = 'none';
  document.getElementById('reg-capture-btn').style.display = 'inline-block';
  document.getElementById('reg-retake-btn').style.display = 'none';
  document.getElementById('reg-save-btn').style.display = 'none';
  document.getElementById('reg-message').style.display = 'none';
  
  // Start camera
  startRegCamera();
}

// Close face registration modal
function closeFaceRegistrationModal() {
  const modal = document.getElementById('face-registration-modal');
  modal.style.display = 'none';
  
  // Stop face detection
  stopRegFaceDetection();
  
  // Stop camera
  if (regCameraStream) {
    regCameraStream.getTracks().forEach(track => track.stop());
    regCameraStream = null;
  }
}

// Start registration camera
async function startRegCamera() {
  try {
    regCameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user' 
      } 
    });
    
    const video = document.getElementById('reg-camera-video');
    video.srcObject = regCameraStream;
    
    document.getElementById('reg-face-status').textContent = 'Position your face in the oval';
    document.getElementById('reg-face-status').style.color = 'white';
    
    // Wait for video to load
    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
    });
    
    // Start real-time face detection if available
    if (window.isFaceApiReady && window.isFaceApiReady()) {
      startRegFaceDetection();
    }
    
  } catch (error) {
    console.error('Camera access error:', error);
    showRegMessage('Failed to access camera. Please check permissions.', 'error');
  }
}

// Real-time face detection for registration
let regDetectionInterval = null;

function startRegFaceDetection() {
  const video = document.getElementById('reg-camera-video');
  const container = document.getElementById('reg-camera-container');
  
  // Create canvas overlay for drawing detection
  let canvas = document.getElementById('reg-detection-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'reg-detection-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);
  }
  
  regDetectionInterval = setInterval(async () => {
    if (!video.videoWidth) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    try {
      const detections = await faceapi.detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks();
      
      const statusEl = document.getElementById('reg-face-status');
      
      if (detections.length === 0) {
        // No face
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        statusEl.textContent = '❌ No face detected';
        statusEl.style.color = '#ef4444';
      } else if (detections.length === 1) {
        // Perfect - one face
        const box = detections[0].detection.box;
        
        // Draw green box
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
        
        // Draw landmarks
        ctx.fillStyle = '#10b981';
        detections[0].landmarks.positions.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        });
        
        statusEl.textContent = '✅ Face detected - Ready to capture';
        statusEl.style.color = '#10b981';
        
      } else {
        // Multiple faces
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        statusEl.textContent = `⚠️ ${detections.length} faces detected - Only one person allowed`;
        statusEl.style.color = '#f59e0b';
      }
    } catch (error) {
      console.error('Detection error:', error);
    }
  }, 100);
}

function stopRegFaceDetection() {
  if (regDetectionInterval) {
    clearInterval(regDetectionInterval);
    regDetectionInterval = null;
  }
  
  const canvas = document.getElementById('reg-detection-canvas');
  if (canvas) {
    canvas.remove();
  }
}

// Capture face photo
async function captureFacePhoto() {
  try {
    // Stop detection overlay
    stopRegFaceDetection();
    
    const video = document.getElementById('reg-camera-video');
    const canvas = document.getElementById('reg-camera-canvas');
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    capturedFaceData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Real face detection with face-api.js
    if (window.isFaceApiReady && window.isFaceApiReady()) {
      showRegMessage('🔍 Detecting face...', 'info');
      
      try {
        const img = await loadImageFromDataURL(capturedFaceData);
        const detections = await faceapi.detectAllFaces(
          img,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptors();
        
        if (detections.length === 0) {
          showRegMessage('❌ No face detected. Please try again with better lighting.', 'error');
          startRegCamera(); // Restart camera
          return;
        }
        
        if (detections.length > 1) {
          showRegMessage('❌ Multiple faces detected. Please ensure only your face is visible.', 'error');
          startRegCamera(); // Restart camera
          return;
        }
        
        // Store face descriptor for later comparison
        window.registeredFaceDescriptor = detections[0].descriptor;
        showRegMessage('✅ Face detected successfully!', 'success');
        
      } catch (error) {
        console.error('Face detection error:', error);
        showRegMessage('⚠️ Face detection unavailable, proceeding anyway', 'warning');
      }
    }
    
    // Show preview
    document.getElementById('reg-photo-img').src = capturedFaceData;
    document.getElementById('reg-photo-preview').style.display = 'block';
    
    // Update buttons
    document.getElementById('reg-capture-btn').style.display = 'none';
    document.getElementById('reg-retake-btn').style.display = 'inline-block';
    document.getElementById('reg-save-btn').style.display = 'inline-block';
    
    // Stop camera
    if (regCameraStream) {
      regCameraStream.getTracks().forEach(track => track.stop());
      regCameraStream = null;
    }
    
  } catch (error) {
    console.error('Capture error:', error);
    showRegMessage('Failed to capture photo. Please try again.', 'error');
  }
}

// Helper: Load image from data URL
function loadImageFromDataURL(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataURL;
  });
}

// Retake face photo
function retakeFacePhoto() {
  capturedFaceData = null;
  document.getElementById('reg-photo-preview').style.display = 'none';
  document.getElementById('reg-capture-btn').style.display = 'inline-block';
  document.getElementById('reg-retake-btn').style.display = 'none';
  document.getElementById('reg-save-btn').style.display = 'none';
  document.getElementById('reg-message').style.display = 'none';
  
  // Restart camera
  startRegCamera();
}

// Save face registration
async function saveFaceRegistration() {
  if (!capturedFaceData) {
    showRegMessage('Please capture a photo first.', 'error');
    return;
  }
  
  try {
    showRegMessage('Saving face registration...', 'info');
    
    // Convert data URL to Blob
    const response = await fetch(capturedFaceData);
    const blob = await response.blob();
    
    // Create FormData
    const formData = new FormData();
    formData.append('facePhoto', blob, 'face-photo.jpg');
    
    // Add face descriptor if available
    if (window.registeredFaceDescriptor) {
      formData.append('faceDescriptor', JSON.stringify(Array.from(window.registeredFaceDescriptor)));
      console.log('✅ Sending 128D face descriptor with registration');
    }
    
    // Get token
    const token = localStorage.getItem('facepay_token');
    if (!token) {
      showRegMessage('Please login first.', 'error');
      return;
    }
    
    // Send to backend with proper auth header
    const result = await fetch(`${CONFIG.API_BASE_URL}/face/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await result.json();
    
    if (data.success) {
      showRegMessage('✓ Face registered successfully!', 'success');
      if (data.hasDescriptor) {
        console.log('✅ Face descriptor saved to database');
      }
      
      // Update UI
      setTimeout(() => {
        closeFaceRegistrationModal();
        // Reload user profile to update face status
        if (typeof loadUserProfile === 'function') {
          loadUserProfile();
        }
      }, 2000);
    } else {
      showRegMessage(data.message || 'Failed to save face registration.', 'error');
    }
    
  } catch (error) {
    console.error('Save face registration error:', error);
    showRegMessage('Failed to save face registration. Please try again.', 'error');
  }
}

// Show registration message
function showRegMessage(message, type = 'info') {
  const messageEl = document.getElementById('reg-message');
  messageEl.style.display = 'block';
  messageEl.textContent = message;
  
  if (type === 'success') {
    messageEl.style.background = 'rgba(16, 185, 129, 0.1)';
    messageEl.style.color = '#10b981';
    messageEl.style.border = '1px solid #10b981';
  } else if (type === 'error') {
    messageEl.style.background = 'rgba(239, 68, 68, 0.1)';
    messageEl.style.color = '#ef4444';
    messageEl.style.border = '1px solid #ef4444';
  } else {
    messageEl.style.background = 'rgba(59, 130, 246, 0.1)';
    messageEl.style.color = '#3b82f6';
    messageEl.style.border = '1px solid #3b82f6';
  }
}
