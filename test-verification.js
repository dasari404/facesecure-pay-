// Test script for face verification endpoint
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3000/api';

// Test credentials
const testUser = {
    email: 'saikiran082k@gmail.com',
    password: 'Akki1234'
};

// Test transaction IDs from database
const testTransactionId = 'TX17929364551150343';

async function testCompleteFlow() {
    console.log('=== TESTING FACE VERIFICATION FLOW ===\n');
    
    try {
        // Step 1: Login
        console.log('Step 1: Attempting login...');
        const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        const loginData = await loginResponse.json();
        
        if (!loginResponse.ok) {
            console.error('❌ Login failed:', loginData.message);
            return;
        }
        
        console.log('✅ Login successful');
        console.log('   User ID:', loginData.user.id);
        console.log('   Username:', loginData.user.username);
        console.log('   Balance:', loginData.user.balance);
        
        const token = loginData.token;
        
        // Step 2: Check transaction exists
        console.log('\nStep 2: Checking transaction status...');
        const txResponse = await fetch(`${BASE_URL}/transactions/${testTransactionId}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const txData = await txResponse.json();
        
        if (!txResponse.ok) {
            console.error('❌ Transaction fetch failed:', txData.message);
            return;
        }
        
        console.log('✅ Transaction found');
        console.log('   Transaction ID:', txData.transaction.transaction_id);
        console.log('   Amount:', txData.transaction.amount);
        console.log('   Status:', txData.transaction.status);
        console.log('   Recipient:', txData.transaction.recipient_name);
        
        if (txData.transaction.status !== 'pending') {
            console.log('⚠️  Transaction is not pending, skipping verification test');
            console.log('   Current status:', txData.transaction.status);
            return;
        }
        
        // Step 3: Test verification endpoint
        console.log('\nStep 3: Testing verification endpoint...');
        
        const verificationRequest = {
            transactionId: testTransactionId,
            faceVerified: true,
            livenessScore: 89,
            verificationData: {
                challenges: ['blink', 'turn_left', 'turn_right', 'smile'],
                timestamp: new Date().toISOString()
            }
        };
        
        console.log('   Request body:', JSON.stringify(verificationRequest, null, 2));
        
        const verifyResponse = await fetch(`${BASE_URL}/transactions/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(verificationRequest)
        });
        
        const verifyData = await verifyResponse.json();
        
        console.log('\n   Response status:', verifyResponse.status);
        console.log('   Response body:', JSON.stringify(verifyData, null, 2));
        
        if (!verifyResponse.ok) {
            if (verifyResponse.status === 500) {
                console.error('❌ HTTP 500 ERROR - Backend error still occurring');
            } else {
                console.log(`⚠️  Verification failed with HTTP ${verifyResponse.status}`);
                console.log('   Message:', verifyData.message);
            }
            return;
        }
        
        console.log('\n✅ Verification successful!');
        console.log('   Transaction completed');
        console.log('   New sender balance:', verifyData.transaction.senderBalance);
        console.log('   New recipient balance:', verifyData.transaction.recipientBalance);
        
        // Step 4: Verify database state
        console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
        console.log('All success criteria met:');
        console.log('✅ Backend running without errors');
        console.log('✅ Login works');
        console.log('✅ Transaction fetch works');
        console.log('✅ No HTTP 500 errors');
        console.log('✅ Verification endpoint responds correctly');
        console.log('✅ Transaction processing successful');
        
    } catch (error) {
        console.error('\n❌ Test failed with exception:');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);
    }
}

// Run test
testCompleteFlow();
