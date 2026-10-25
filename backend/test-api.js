// Simple API endpoint test
const http = require('http');

function testEndpoint(method, path, data = null) {
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

async function runTests() {
  console.log('\n🧪 Testing FaceSecure Pay API Endpoints\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing /health endpoint...');
    const health = await testEndpoint('GET', '/health');
    console.log(`   ✅ Status: ${health.status}, Message: ${health.data.message}\n`);
    
    // Test 2: Check endpoints exist (will fail without DB, but validates routing)
    console.log('2. Testing API routes are registered...');
    
    const endpoints = [
      { method: 'POST', path: '/api/auth/register', name: 'User Registration' },
      { method: 'POST', path: '/api/auth/login', name: 'User Login' },
      { method: 'GET', path: '/api/user/profile', name: 'User Profile' },
      { method: 'POST', path: '/api/transactions/send', name: 'Send Money' },
      { method: 'GET', path: '/api/transactions', name: 'Transaction History' },
      { method: 'POST', path: '/api/admin/login', name: 'Admin Login' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await testEndpoint(endpoint.method, endpoint.path, {});
        // 400/401/403/500 means route exists but validation/auth failed (expected without DB/token)
        if ([400, 401, 403, 500].includes(result.status)) {
          console.log(`   ✅ ${endpoint.name} route exists (${endpoint.method} ${endpoint.path})`);
        } else if (result.status === 404) {
          console.log(`   ❌ ${endpoint.name} route not found!`);
        } else {
          console.log(`   ⚠️  ${endpoint.name} unexpected status: ${result.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint.name} request failed`);
      }
    }
    
    console.log('\n✨ API structure test complete!');
    console.log('\n⚠️  Note: To fully test with real data, you need to:');
    console.log('   1. Install and start MySQL server');
    console.log('   2. Update backend/.env with your MySQL password');
    console.log('   3. Run: npm run setup');
    console.log('   4. Then test registration, login, and transactions\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Wait a bit for server to be ready, then run tests
setTimeout(runTests, 1000);
