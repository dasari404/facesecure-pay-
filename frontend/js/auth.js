// Authentication Logic

// Register new user
async function register(email, password, fullName, phone, username) {
  try {
    const response = await apiCall(API.REGISTER, {
      method: 'POST',
      body: {
        email,
        password,
        full_name: fullName,
        phone: phone || undefined,
        username
      }
    });
    
    if (response.success) {
      // Store token and user data
      localStorage.setItem('facepay_token', response.token);
      localStorage.setItem('facepay_user', JSON.stringify(response.user));
      
      // Redirect to transactions page
      window.location.href = 'transactions.html';
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// Login existing user
async function login(email, password) {
  try {
    const response = await apiCall(API.LOGIN, {
      method: 'POST',
      body: {
        email,
        password
      }
    });
    
    if (response.success) {
      // Store token and user data
      localStorage.setItem('facepay_token', response.token);
      localStorage.setItem('facepay_user', JSON.stringify(response.user));
      
      // Redirect to transactions page
      window.location.href = 'transactions.html';
    } else {
      throw new Error(response.message || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Logout user
function logout() {
  // Clear all user data
  localStorage.removeItem('facepay_token');
  localStorage.removeItem('facepay_user');
  
  // Redirect to login
  window.location.href = 'login.html';
}

// Check if user is authenticated
function checkAuth() {
  const token = localStorage.getItem('facepay_token');
  
  if (!token) {
    // Redirect to login if no token found
    window.location.href = 'login.html';
    return false;
  }
  
  return true;
}

// Get current user from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('facepay_user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error('Failed to parse user data:', e);
      return null;
    }
  }
  return null;
}

// Fetch user profile from server
async function fetchUserProfile() {
  try {
    const response = await apiCall(API.GET_USER_PROFILE, {
      method: 'GET'
    });
    
    if (response.success) {
      // Update stored user data
      localStorage.setItem('facepay_user', JSON.stringify(response.user));
      return response.user;
    } else {
      throw new Error(response.message || 'Failed to fetch profile');
    }
  } catch (error) {
    console.error('Profile fetch error:', error);
    
    // If unauthorized, redirect to login
    if (error.message.includes('token') || error.message.includes('unauthorized')) {
      logout();
    }
    
    throw error;
  }
}

console.log('Auth module loaded');
