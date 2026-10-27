// Supabase Configuration for FaceSecure Pay
// Replace these with your actual keys from: https://supabase.com/dashboard/project/oosuhjvvyncmpoabmvru/settings/api

const SUPABASE_CONFIG = {
    url: 'https://oosuhjvvyncmpoabmvru.supabase.co',
    anonKey: 'YOUR_ANON_KEY_HERE'  // Get from Supabase Dashboard → Settings → API
};

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Export for use in other modules
window.supabase = supabaseClient;

console.log('✅ Supabase client initialized');

// Auth state listener
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event);
    
    if (event === 'SIGNED_IN') {
        console.log('✅ User signed in:', session.user);
        localStorage.setItem('supabase_session', JSON.stringify(session));
    } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        localStorage.removeItem('supabase_session');
        
        // Redirect to login if not already there
        if (!window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
            window.location.href = 'login.html';
        }
    } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed');
        localStorage.setItem('supabase_session', JSON.stringify(session));
    }
});

// Helper: Get current user
async function getCurrentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) {
        console.error('Error getting user:', error);
        return null;
    }
    return user;
}

// Helper: Get user profile
async function getUserProfile(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error getting profile:', error);
        return null;
    }
    
    return data;
}

// Helper: Check if user is authenticated
async function isAuthenticated() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session !== null;
}

// Export helpers
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.isAuthenticated = isAuthenticated;
