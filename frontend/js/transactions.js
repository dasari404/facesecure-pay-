// Transactions Logic

let currentTransactionId = null;
let recipientSearchTimeout = null;

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

// Search for recipient (debounced)
function searchRecipient(email) {
  // Clear previous timeout
  if (recipientSearchTimeout) {
    clearTimeout(recipientSearchTimeout);
  }
  
  // Hide recipient found indicator
  document.getElementById('recipient-found').classList.remove('show');
  
  if (!email || email.length < 3) {
    return;
  }
  
  // Debounce search
  recipientSearchTimeout = setTimeout(async () => {
    try {
      const response = await apiCall(API.SEARCH_USER + `?query=${encodeURIComponent(email)}`, {
        method: 'GET'
      });
      
      if (response.success && response.users && response.users.length > 0) {
        const user = response.users[0];
        
        // Show recipient found
        document.getElementById('recipient-name').textContent = user.full_name;
        document.getElementById('recipient-id').textContent = user.email;
        document.getElementById('recipient-found').classList.add('show');
      }
    } catch (error) {
      console.error('Recipient search error:', error);
    }
  }, 500);
}

// Handle send money form submission
async function handleSendMoneySubmit(event) {
  event.preventDefault();
  
  const recipientEmail = document.getElementById('recipient-email').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const description = document.getElementById('description').value;
  const transactionType = document.getElementById('transaction-type').value;
  
  try {
    const response = await apiCall(API.SEND_MONEY, {
      method: 'POST',
      body: {
        recipientEmail,
        amount,
        description,
        transactionType
      }
    });
    
    if (response.success) {
      // Store transaction ID
      currentTransactionId = response.transactionId;
      
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
  document.getElementById('verification-section').classList.remove('show');
  document.getElementById('camera-view').classList.remove('show');
  document.getElementById('send-money-form').reset();
  document.getElementById('recipient-found').classList.remove('show');
  
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
