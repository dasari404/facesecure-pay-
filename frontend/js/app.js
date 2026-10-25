// FacePay Main App

// Initialize app on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('FacePay App Initialized');
    
    // Check if user is logged in
    const userId = getCurrentUserId();
    if (userId) {
        // User is logged in, show dashboard
        showPage('dashboard-page');
        loadDashboard();
    } else {
        // Show landing page
        showPage('landing-page');
    }
});

// Note: Other functions will be added in separate JS files
// This is just for basic initialization
