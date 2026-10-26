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
    
    return `
      <div class="transaction-item">
        <div class="transaction-left">
          <div class="transaction-icon ${iconClass}">${icon}</div>
          <div class="transaction-details">
            <h4>${isSent ? 'Sent to' : 'Received from'} ${otherParty}</h4>
            <p>${formatDate(tx.createdAt)}</p>
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
  // Check authentication
  if (!checkAuth()) {
    return;
  }
  
  // Load user profile and transactions
  await loadUserProfile();
  await loadTransactionHistory();
  
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
});

console.log('Transactions module loaded');
