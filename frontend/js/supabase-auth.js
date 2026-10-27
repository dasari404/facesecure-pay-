// Supabase Authentication with Phone OTP
// Dependencies: supabase-config.js must be loaded first

// =====================================================
// REGISTER WITH PHONE OTP
// =====================================================
async function registerWithPhoneOTP(phone, fullName, username) {
    try {
        console.log('📱 Starting registration for:', phone);
        
        // Normalize phone number (remove spaces, dashes, etc.)
        const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
        
        // Step 1: Send OTP to phone
        const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
            phone: normalizedPhone,
            options: {
                channel: 'sms',  // or 'whatsapp'
                data: {
                    full_name: fullName,
                    username: username
                }
            }
        });
        
        if (otpError) {
            console.error('OTP send error:', otpError);
            throw new Error(otpError.message || 'Failed to send OTP');
        }
        
        console.log('✅ OTP sent to:', normalizedPhone);
        
        // Step 2: Show OTP modal and wait for user input
        const otp = await showOTPModal(normalizedPhone, 'register');
        
        // Step 3: Verify OTP
        const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
            phone: normalizedPhone,
            token: otp,
            type: 'sms'
        });
        
        if (verifyError) {
            console.error('OTP verification error:', verifyError);
            throw new Error(verifyError.message || 'Invalid OTP');
        }
        
        console.log('✅ OTP verified, user created:', session.user);
        
        // Step 4: Create profile in profiles table
        const paymentNumber = phone.replace(/\D/g, '');  // Remove all non-digits
        
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: session.user.id,
                phone: normalizedPhone,
                payment_number: paymentNumber,
                full_name: fullName,
                username: username,
                balance: 1000.00,
                face_registered: false
            })
            .select()
            .single();
        
        if (profileError) {
            console.error('Profile creation error:', profileError);
            throw new Error('Failed to create profile: ' + profileError.message);
        }
        
        console.log('✅ Profile created:', profile);
        
        return {
            success: true,
            user: session.user,
            profile: profile,
            payment_number: paymentNumber
        };
        
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

// =====================================================
// LOGIN WITH PHONE OTP
// =====================================================
async function loginWithPhoneOTP(phone) {
    try {
        console.log('📱 Starting login for:', phone);
        
        // Normalize phone number
        const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
        
        // Step 1: Send OTP
        const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
            phone: normalizedPhone,
            options: {
                channel: 'sms'
            }
        });
        
        if (otpError) {
            console.error('OTP send error:', otpError);
            throw new Error(otpError.message || 'Failed to send OTP');
        }
        
        console.log('✅ OTP sent to:', normalizedPhone);
        
        // Step 2: Show OTP modal
        const otp = await showOTPModal(normalizedPhone, 'login');
        
        // Step 3: Verify OTP
        const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
            phone: normalizedPhone,
            token: otp,
            type: 'sms'
        });
        
        if (verifyError) {
            console.error('OTP verification error:', verifyError);
            throw new Error(verifyError.message || 'Invalid OTP');
        }
        
        console.log('✅ Logged in:', session.user);
        
        // Get user profile
        const profile = await getUserProfile(session.user.id);
        
        return {
            success: true,
            user: session.user,
            profile: profile
        };
        
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// =====================================================
// LOGOUT
// =====================================================
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) throw error;
        
        console.log('👋 Logged out successfully');
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
}

// =====================================================
// SHOW OTP MODAL (UI Component)
// =====================================================
function showOTPModal(phone, mode = 'login') {
    return new Promise((resolve, reject) => {
        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'otp-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: #1a1d2e;
                border-radius: 16px;
                padding: 32px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            ">
                <h2 style="color: #fff; margin: 0 0 8px 0; font-size: 24px;">Enter OTP</h2>
                <p style="color: #a0aec0; margin: 0 0 24px 0; font-size: 14px;">
                    We sent a 6-digit code to <strong>${phone}</strong>
                </p>
                
                <div style="display: flex; gap: 8px; margin-bottom: 24px;" id="otp-inputs">
                    <input type="text" maxlength="1" class="otp-digit" style="
                        width: 50px;
                        height: 60px;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        border: 2px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.05);
                        color: #fff;
                        border-radius: 8px;
                        outline: none;
                    " />
                    <input type="text" maxlength="1" class="otp-digit" style="
                        width: 50px;
                        height: 60px;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        border: 2px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.05);
                        color: #fff;
                        border-radius: 8px;
                        outline: none;
                    " />
                    <input type="text" maxlength="1" class="otp-digit" style="
                        width: 50px;
                        height: 60px;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        border: 2px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.05);
                        color: #fff;
                        border-radius: 8px;
                        outline: none;
                    " />
                    <input type="text" maxlength="1" class="otp-digit" style="
                        width: 50px;
                        height: 60px;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        border: 2px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.05);
                        color: #fff;
                        border-radius: 8px;
                        outline: none;
                    " />
                    <input type="text" maxlength="1" class="otp-digit" style="
                        width: 50px;
                        height: 60px;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        border: 2px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.05);
                        color: #fff;
                        border-radius: 8px;
                        outline: none;
                    " />
                    <input type="text" maxlength="1" class="otp-digit" style="
                        width: 50px;
                        height: 60px;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        border: 2px solid rgba(255,255,255,0.1);
                        background: rgba(255,255,255,0.05);
                        color: #fff;
                        border-radius: 8px;
                        outline: none;
                    " />
                </div>
                
                <div id="otp-error" style="
                    display: none;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    font-size: 14px;
                "></div>
                
                <button id="verify-otp-btn" style="
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-bottom: 12px;
                ">Verify OTP</button>
                
                <button id="cancel-otp-btn" style="
                    width: 100%;
                    padding: 14px;
                    background: transparent;
                    color: #a0aec0;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                ">Cancel</button>
                
                <p style="color: #a0aec0; text-align: center; margin-top: 16px; font-size: 12px;">
                    Didn't receive code? <a href="#" id="resend-otp" style="color: #667eea;">Resend OTP</a>
                </p>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Get elements
        const inputs = modal.querySelectorAll('.otp-digit');
        const verifyBtn = modal.querySelector('#verify-otp-btn');
        const cancelBtn = modal.querySelector('#cancel-otp-btn');
        const resendBtn = modal.querySelector('#resend-otp');
        const errorDiv = modal.querySelector('#otp-error');
        
        // Focus first input
        inputs[0].focus();
        
        // Auto-focus next input
        inputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
                
                // Auto-submit when all filled
                const allFilled = Array.from(inputs).every(inp => inp.value);
                if (allFilled) {
                    verifyBtn.click();
                }
            });
            
            // Backspace to previous input
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    inputs[index - 1].focus();
                }
            });
        });
        
        // Verify button
        verifyBtn.addEventListener('click', () => {
            const otp = Array.from(inputs).map(inp => inp.value).join('');
            
            if (otp.length !== 6) {
                showError('Please enter all 6 digits');
                return;
            }
            
            document.body.removeChild(modal);
            resolve(otp);
        });
        
        // Cancel button
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            reject(new Error('OTP verification cancelled'));
        });
        
        // Resend OTP
        resendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                resendBtn.textContent = 'Sending...';
                resendBtn.style.pointerEvents = 'none';
                
                if (mode === 'register') {
                    // Resend for registration
                    await supabase.auth.signInWithOtp({
                        phone: phone,
                        options: { channel: 'sms' }
                    });
                } else {
                    // Resend for login
                    await supabase.auth.signInWithOtp({
                        phone: phone,
                        options: { channel: 'sms' }
                    });
                }
                
                showError('OTP resent successfully!', 'success');
                
                setTimeout(() => {
                    resendBtn.textContent = 'Resend OTP';
                    resendBtn.style.pointerEvents = 'auto';
                }, 3000);
                
            } catch (error) {
                showError('Failed to resend OTP');
                resendBtn.textContent = 'Resend OTP';
                resendBtn.style.pointerEvents = 'auto';
            }
        });
        
        function showError(message, type = 'error') {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.background = type === 'success' 
                ? 'rgba(16, 185, 129, 0.1)' 
                : 'rgba(239, 68, 68, 0.1)';
            errorDiv.style.borderColor = type === 'success' 
                ? 'rgba(16, 185, 129, 0.3)' 
                : 'rgba(239, 68, 68, 0.3)';
            errorDiv.style.color = type === 'success' ? '#10b981' : '#ef4444';
            
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        }
    });
}

// Export functions
window.registerWithPhoneOTP = registerWithPhoneOTP;
window.loginWithPhoneOTP = loginWithPhoneOTP;
window.logout = logout;

console.log('✅ Supabase auth module loaded');
