// FacePay Configuration

const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api',
    LIVENESS_API_URL: 'http://localhost:5000/api',
    STARTING_BALANCE: 1000.00,
    MIN_TRANSACTION_AMOUNT: 1.00,
    LIVENESS_THRESHOLD: 60, // Minimum score to pass verification
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
};

// API Endpoints
const API = {
    // Authentication
    REGISTER: `${CONFIG.API_BASE_URL}/auth/register`,
    LOGIN: `${CONFIG.API_BASE_URL}/auth/login`,
    LOGOUT: `${CONFIG.API_BASE_URL}/auth/logout`,
    
    // User
    GET_USER_PROFILE: `${CONFIG.API_BASE_URL}/user/profile`,
    SEARCH_USER: `${CONFIG.API_BASE_URL}/user/search`,
    
    // Transactions
    SEND_MONEY: `${CONFIG.API_BASE_URL}/transactions/send`,
    GET_TRANSACTIONS: `${CONFIG.API_BASE_URL}/transactions`,
    GET_TRANSACTION: (txId) => `${CONFIG.API_BASE_URL}/transactions/${txId}`,
    TRANSACTIONS_VERIFY: `${CONFIG.API_BASE_URL}/transactions/verify`,
    
    // Fraud
    CHECK_FRAUD: `${CONFIG.API_BASE_URL}/transactions/fraud/check`,
    REPORT_FRAUD: `${CONFIG.API_BASE_URL}/fraud/report`,
    
    // Face Verification
    VERIFY_FACE: `${CONFIG.API_BASE_URL}/transaction/verify-face`,
    DETECT_FACE: `${CONFIG.LIVENESS_API_URL}/detect-face`,
    
    // Admin
    ADMIN_LOGIN: `${CONFIG.API_BASE_URL}/admin/login`,
    ADMIN_STATS: `${CONFIG.API_BASE_URL}/admin/stats`,
    ADMIN_ACTIVITY: `${CONFIG.API_BASE_URL}/admin/activity`,
    
    // Reports
    REPORT_SUBMIT: `${CONFIG.API_BASE_URL}/reports/submit`,
    REPORT_STATUS: (ref) => `${CONFIG.API_BASE_URL}/reports/status/${ref}`,
    ADMIN_REPORTS_ALL: `${CONFIG.API_BASE_URL}/reports/admin/all`,
    ADMIN_REPORTS_STATS: `${CONFIG.API_BASE_URL}/reports/admin/stats`,
    ADMIN_REPORT_UPDATE: (id) => `${CONFIG.API_BASE_URL}/reports/admin/${id}/status`,
    ADMIN_REPORT_ASSIGN: (id) => `${CONFIG.API_BASE_URL}/reports/admin/${id}/assign`,
};

// Helper function to make API calls
async function apiCall(url, options = {}) {
    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    // Add auth token if available
    const token = options.isAdmin 
        ? localStorage.getItem('facepay_admin_token')
        : localStorage.getItem('facepay_token');
    
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add body if present
    if (options.body && config.method !== 'GET') {
        config.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Liveness Challenges
const LIVENESS_CHALLENGES = [
    {
        id: 'blink',
        title: 'Blink Detection',
        instruction: 'Please blink your eyes naturally',
        icon: '👁️',
        duration: 3000
    },
    {
        id: 'turn_left',
        title: 'Turn Head Left',
        instruction: 'Slowly turn your head to the left',
        icon: '⬅️',
        duration: 3000
    },
    {
        id: 'turn_right',
        title: 'Turn Head Right',
        instruction: 'Slowly turn your head to the right',
        icon: '➡️',
        duration: 3000
    },
    {
        id: 'smile',
        title: 'Smile',
        instruction: 'Please smile naturally',
        icon: '😊',
        duration: 2000
    }
];

// Transaction Status
const TRANSACTION_STATUS = {
    COMPLETED: 'completed',
    BLOCKED: 'blocked',
    PENDING: 'pending',
    FAILED: 'failed'
};

// User Roles
const USER_ROLES = {
    USER: 'user',
    ADMIN: 'admin'
};

// Helper function to make API calls
async function apiCall(url, options = {}) {
    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    // Add auth token if available
    const token = options.isAdmin 
        ? localStorage.getItem('facepay_admin_token')
        : localStorage.getItem('facepay_token');
    
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add body if present
    if (options.body && config.method !== 'GET') {
        config.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Storage helper
const Storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage set error:', e);
        }
    },
    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },
    remove: (key) => {
        localStorage.removeItem(key);
    },
    clear: () => {
        localStorage.clear();
    }
};
