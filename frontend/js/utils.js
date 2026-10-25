// Utility Functions

// Format currency
function formatCurrency(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-IN', options);
}

// Show/hide pages
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show requested page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

// Show/hide dashboard sections
function showDashboardSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show requested section
    const targetSection = document.getElementById(`${sectionId}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
}

// Show alert
function showAlert(elementId, message, type = 'error') {
    const alertEl = document.getElementById(elementId);
    if (alertEl) {
        alertEl.textContent = message;
        alertEl.className = `alert alert-${type}`;
        alertEl.style.display = 'flex';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alertEl.style.display = 'none';
        }, 5000);
    }
}

// Hide alert
function hideAlert(elementId) {
    const alertEl = document.getElementById(elementId);
    if (alertEl) {
        alertEl.style.display = 'none';
    }
}

// Validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone
function isValidPhone(phone) {
    const phoneRegex = /^[+]?[\d\s-]{10,}$/;
    return phoneRegex.test(phone);
}

// Get user ID from localStorage
function getCurrentUserId() {
    return localStorage.getItem('userId');
}

// Get user name from localStorage
function getCurrentUserName() {
    return localStorage.getItem('userName');
}

// Set current user
function setCurrentUser(userId, userName, userEmail) {
    localStorage.setItem('userId', userId);
    localStorage.setItem('userName', userName);
    localStorage.setItem('userEmail', userEmail);
    localStorage.setItem('loginTime', Date.now());
}

// Clear current user
function clearCurrentUser() {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('loginTime');
}

// Check session timeout
function checkSession() {
    const loginTime = localStorage.getItem('loginTime');
    if (loginTime) {
        const elapsed = Date.now() - parseInt(loginTime);
        if (elapsed > CONFIG.SESSION_TIMEOUT) {
            clearCurrentUser();
            showPage('landing-page');
            alert('Your session has expired. Please login again.');
            return false;
        }
    }
    return true;
}

// Make API request
async function apiRequest(url, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Request failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Generate random string
function generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get random challenge
function getRandomChallenge() {
    const randomIndex = Math.floor(Math.random() * LIVENESS_CHALLENGES.length);
    return LIVENESS_CHALLENGES[randomIndex];
}

// Get multiple random challenges
function getRandomChallenges(count = 2) {
    const shuffled = [...LIVENESS_CHALLENGES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Convert image to base64
function imageToBase64(imgElement) {
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.width;
    canvas.height = imgElement.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
}

// Show loading state
function setLoadingState(buttonElement, loading = true) {
    if (loading) {
        buttonElement.disabled = true;
        buttonElement.dataset.originalText = buttonElement.textContent;
        buttonElement.innerHTML = '<span class="loading-spinner"></span> Loading...';
    } else {
        buttonElement.disabled = false;
        buttonElement.textContent = buttonElement.dataset.originalText || buttonElement.textContent;
    }
}

// Log (for debugging)
function log(message, data = null) {
    console.log(`[FacePay] ${message}`, data || '');
}

// Error log
function logError(message, error) {
    console.error(`[FacePay Error] ${message}`, error);
}
