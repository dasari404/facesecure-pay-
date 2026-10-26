const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function pass(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function fail(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function info(msg) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

let aliceToken = '';
let bobToken = '';
let aliceUserId = '';
let bobUserId = '';
let transactionId = '';

async function runTests() {
  console.log('\n=== Username-Based Recipient Lookup Tests ===\n');
  
  const timestamp = Date.now();
  const aliceUsername = `alice${timestamp}`;
  const bobUsername = `bob${timestamp}`;
  
  try {
    // Test 1: Register Alice with username
    info(`Test 1: Register Alice with username "${aliceUsername}"`);
    try {
      const aliceRes = await axios.post(`${API_BASE}/auth/register`, {
        username: aliceUsername,
        email: `alice_test_${timestamp}@example.com`,
        password: 'password123',
        full_name: 'Alice Test',
        phone: '+1234567890'
      });
      
      if (aliceRes.data.success && aliceRes.data.user.username === aliceUsername) {
        pass('Alice registered successfully with username');
        aliceToken = aliceRes.data.token;
        aliceUserId = aliceRes.data.user.id;
        console.log(`  Alice ID: ${aliceUserId}, Username: ${aliceRes.data.user.username}`);
      } else {
        fail('Alice registration response missing username');
      }
    } catch (error) {
      fail(`Alice registration failed: ${error.response?.data?.message || error.message}`);
    }
    
    // Test 2: Register Bob with username
    info(`\nTest 2: Register Bob with username "${bobUsername}"`);
    try {
      const bobRes = await axios.post(`${API_BASE}/auth/register`, {
        username: bobUsername,
        email: `bob_test_${timestamp}@example.com`,
        password: 'password456',
        full_name: 'Bob Test',
        phone: '+0987654321'
      });
      
      if (bobRes.data.success && bobRes.data.user.username === bobUsername) {
        pass('Bob registered successfully with username');
        bobToken = bobRes.data.token;
        bobUserId = bobRes.data.user.id;
        console.log(`  Bob ID: ${bobUserId}, Username: ${bobRes.data.user.username}`);
      } else {
        fail('Bob registration response missing username');
      }
    } catch (error) {
      fail(`Bob registration failed: ${error.response?.data?.message || error.message}`);
    }
    
    // Test 3: Search by username
    info(`\nTest 3: Alice searches for Bob by username "${bobUsername}"`);
    try {
      const searchRes = await axios.get(`${API_BASE}/user/search?query=${bobUsername}`, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      
      if (searchRes.data.success && searchRes.data.users.length > 0 && searchRes.data.users[0].username === bobUsername) {
        pass('Search by username found Bob');
        console.log(`  Found: ${searchRes.data.users[0].username} - ${searchRes.data.users[0].full_name}`);
      } else {
        fail('Search by username did not find Bob');
      }
    } catch (error) {
      fail(`Username search failed: ${error.response?.data?.message || error.message}`);
    }
    
    // Test 4: Search by email
    info('\nTest 4: Alice searches for Bob by email');
    try {
      const bobEmail = (await axios.get(`${API_BASE}/user/profile`, {
        headers: { Authorization: `Bearer ${bobToken}` }
      })).data.user.email;
      
      const searchRes = await axios.get(`${API_BASE}/user/search?query=${bobEmail}`, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      
      if (searchRes.data.success && searchRes.data.users.length > 0) {
        pass('Search by email found Bob');
      } else {
        fail('Search by email did not find Bob');
      }
    } catch (error) {
      fail(`Email search failed: ${error.response?.data?.message || error.message}`);
    }
    
    // Test 5: Search by phone
    info('\nTest 5: Alice searches for Bob by phone');
    try {
      const searchRes = await axios.get(`${API_BASE}/user/search?query=${encodeURIComponent('+0987654321')}`, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      
      if (searchRes.data.success && searchRes.data.users.length > 0) {
        pass('Search by phone found Bob');
      } else {
        fail('Search by phone did not find Bob');
      }
    } catch (error) {
      fail(`Phone search failed: ${error.response?.data?.message || error.message}`);
    }
    
    // Test 6: Search by user ID
    info('\nTest 6: Alice searches for Bob by user ID');
    try {
      const searchRes = await axios.get(`${API_BASE}/user/search?query=${bobUserId}`, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      
      if (searchRes.data.success && searchRes.data.users.length > 0) {
        pass('Search by user ID found Bob');
      } else {
        fail('Search by user ID did not find Bob');
      }
    } catch (error) {
      fail(`User ID search failed: ${error.response?.data?.message || error.message}`);
    }
    
    // Test 7: Create transaction using username
    info(`\nTest 7: Alice creates transaction to Bob using username "${bobUsername}"`);
    try {
      const txRes = await axios.post(`${API_BASE}/transactions/send`, {
        recipientIdentifier: bobUsername,
        amount: 20,
        description: 'Test payment via username',
        transactionType: 'personal'
      }, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      
      if (txRes.data.success && txRes.data.recipient.username === bobUsername) {
        pass('Transaction created successfully using username');
        transactionId = txRes.data.transactionId;
        console.log(`  Transaction ID: ${transactionId}`);
        console.log(`  Recipient: ${txRes.data.recipient.username} (${txRes.data.recipient.name})`);
      } else {
        fail('Transaction creation response missing username');
      }
    } catch (error) {
      fail(`Transaction creation failed: ${error.response?.data?.message || error.message}`);
    }
    
    // Test 8: Self-transfer prevention
    info(`\nTest 8: Alice tries to send to herself (should be blocked)`);
    try {
      const selfTxRes = await axios.post(`${API_BASE}/transactions/send`, {
        recipientIdentifier: aliceUsername,
        amount: 10,
        description: 'Self transfer test',
        transactionType: 'personal'
      }, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      
      fail('Self-transfer was NOT blocked (should have been rejected)');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message.includes('yourself')) {
        pass('Self-transfer correctly blocked');
      } else {
        fail(`Self-transfer failed with unexpected error: ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Test 9: Invalid recipient
    info('\nTest 9: Alice tries to send to non-existent user');
    try {
      const invalidTxRes = await axios.post(`${API_BASE}/transactions/send`, {
        recipientIdentifier: 'nonexistent_user_999',
        amount: 5,
        description: 'Invalid recipient test',
        transactionType: 'personal'
      }, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      
      fail('Invalid recipient was NOT rejected');
    } catch (error) {
      if (error.response?.status === 404) {
        pass('Invalid recipient correctly rejected with 404');
      } else {
        fail(`Invalid recipient failed with unexpected error: ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Test 10: Username uniqueness
    info('\nTest 10: Try to register with duplicate username');
    try {
      const dupRes = await axios.post(`${API_BASE}/auth/register`, {
        username: aliceUsername, // Duplicate username
        email: `duplicate_${timestamp}@example.com`,
        password: 'password999',
        full_name: 'Duplicate User'
      });
      
      fail('Duplicate username was NOT rejected');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message.includes('Username already taken')) {
        pass('Duplicate username correctly rejected');
      } else {
        fail(`Duplicate username check failed: ${error.response?.data?.message || error.message}`);
      }
    }
    
    console.log('\n=== Test Summary ===');
    console.log(`${colors.green}All critical username functionality tests completed${colors.reset}`);
    console.log(`\nTest users created:`);
    console.log(`  - Alice (ID: ${aliceUserId}, Username: ${aliceUsername})`);
    console.log(`  - Bob (ID: ${bobUserId}, Username: ${bobUsername})`);
    console.log(`\nTransaction created: ${transactionId}`);
    console.log(`\n${colors.yellow}Note: Transaction verification and completion requires face verification flow${colors.reset}\n`);
    
  } catch (error) {
    console.error(`\n${colors.red}Unexpected error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Check if server is running
axios.get('http://localhost:3000/health')
  .then(() => {
    info('Server is running, starting tests...\n');
    runTests();
  })
  .catch(() => {
    fail('Server is not running on http://localhost:3000');
    console.log('Please start the server with: npm start');
    process.exit(1);
  });
