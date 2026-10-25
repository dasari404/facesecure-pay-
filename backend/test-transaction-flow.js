// Complete transaction flow test
const http = require('http');

function apiCall(method, path, token = null, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testTransactionFlow() {
  console.log('\n🧪 Testing Complete Transaction Flow\n');
  
  try {
    // Step 1: Login as Alice
    console.log('1. Login as Alice...');
    const login = await apiCall('POST', '/api/auth/login', null, {
      email: 'alice@example.com',
      password: 'password123'
    });
    
    if (!login.data.success) {
      throw new Error('Login failed');
    }
    
    const aliceToken = login.data.token;
    console.log(`   ✅ Alice logged in (balance: ₹${login.data.user.balance})\n`);
    
    // Step 2: Create transaction
    console.log('2. Creating transaction (Alice → Bob, ₹250.50)...');
    const transaction = await apiCall('POST', '/api/transactions/send', aliceToken, {
      recipientEmail: 'bob@example.com',
      amount: 250.50,
      description: 'Test payment',
      transactionType: 'personal'
    });
    
    if (!transaction.data.success) {
      throw new Error('Transaction creation failed: ' + transaction.data.message);
    }
    
    const txId = transaction.data.transactionId;
    console.log(`   ✅ Transaction created: ${txId}\n`);
    
    // Step 3: Fraud check
    console.log('3. Running fraud detection...');
    const fraud = await apiCall('POST', '/api/transactions/fraud/check', aliceToken, {
      transactionId: txId
    });
    
    if (!fraud.data.success) {
      throw new Error('Fraud check failed');
    }
    
    console.log(`   ✅ Fraud Score: ${fraud.data.fraudCheck.fraudScore}`);
    console.log(`   ✅ Risk Level: ${fraud.data.fraudCheck.riskLevel}\n`);
    
    if (fraud.data.fraudCheck.shouldBlock) {
      console.log('   ⚠️  Transaction blocked due to high fraud risk\n');
      return;
    }
    
    // Step 4: Verify transaction
    console.log('4. Verifying transaction with face data...');
    const verify = await apiCall('POST', '/api/transactions/verify', aliceToken, {
      transactionId: txId,
      faceVerified: true,
      livenessScore: 87.5,
      verificationData: {
        timestamp: new Date().toISOString()
      }
    });
    
    if (!verify.data.success) {
      throw new Error('Verification failed: ' + verify.data.message);
    }
    
    console.log(`   ✅ Transaction completed!`);
    console.log(`   ✅ Alice new balance: ₹${verify.data.transaction.senderBalance}`);
    console.log(`   ✅ Bob new balance: ₹${verify.data.transaction.recipientBalance}\n`);
    
    // Step 5: Get transaction history
    console.log('5. Fetching transaction history...');
    const history = await apiCall('GET', '/api/transactions?limit=5', aliceToken);
    
    if (!history.data.success) {
      throw new Error('Failed to fetch history');
    }
    
    console.log(`   ✅ Found ${history.data.transactions.length} transactions`);
    history.data.transactions.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.type === 'sent' ? '↗️ Sent' : '↙️ Received'} ₹${tx.amount} - ${tx.status}`);
    });
    
    console.log('\n✨ All tests passed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Wait for server to be ready, then run tests
setTimeout(testTransactionFlow, 1000);
