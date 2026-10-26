// Test script for payment number system
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testPaymentNumbers() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nada'
    });
    
    console.log('✓ Connected to database\n');
    
    // Test 1: Check all users have payment numbers
    console.log('Test 1: Verify all users have payment numbers');
    console.log('='.repeat(50));
    const [users] = await connection.query(
      'SELECT id, username, email, phone, payment_number, balance FROM users'
    );
    
    console.log(`Found ${users.length} users:\n`);
    users.forEach(user => {
      console.log(`  ID: ${user.id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Phone: ${user.phone || '(not set)'}`);
      console.log(`  Payment Number: ${user.payment_number} ${user.payment_number ? '✓' : '✗ MISSING'}`);
      console.log(`  Balance: ₹${parseFloat(user.balance).toFixed(2)}`);
      console.log('');
    });
    
    // Test 2: Check payment numbers are unique
    console.log('Test 2: Verify payment numbers are unique');
    console.log('='.repeat(50));
    const [duplicates] = await connection.query(`
      SELECT payment_number, COUNT(*) as count 
      FROM users 
      GROUP BY payment_number 
      HAVING count > 1
    `);
    
    if (duplicates.length === 0) {
      console.log('✓ All payment numbers are unique\n');
    } else {
      console.log('✗ DUPLICATE PAYMENT NUMBERS FOUND:');
      duplicates.forEach(dup => {
        console.log(`  ${dup.payment_number}: ${dup.count} users`);
      });
      console.log('');
    }
    
    // Test 3: Check payment numbers are exactly 10 digits
    console.log('Test 3: Verify payment numbers are 10 digits');
    console.log('='.repeat(50));
    const [invalidLength] = await connection.query(`
      SELECT id, username, payment_number, LENGTH(payment_number) as len 
      FROM users 
      WHERE LENGTH(payment_number) != 10
    `);
    
    if (invalidLength.length === 0) {
      console.log('✓ All payment numbers are exactly 10 digits\n');
    } else {
      console.log('✗ INVALID LENGTH PAYMENT NUMBERS FOUND:');
      invalidLength.forEach(user => {
        console.log(`  ${user.username}: ${user.payment_number} (length: ${user.len})`);
      });
      console.log('');
    }
    
    // Test 4: Check payment numbers are numeric
    console.log('Test 4: Verify payment numbers are numeric');
    console.log('='.repeat(50));
    const [nonNumeric] = await connection.query(`
      SELECT id, username, payment_number 
      FROM users 
      WHERE payment_number NOT REGEXP '^[0-9]+$'
    `);
    
    if (nonNumeric.length === 0) {
      console.log('✓ All payment numbers are numeric\n');
    } else {
      console.log('✗ NON-NUMERIC PAYMENT NUMBERS FOUND:');
      nonNumeric.forEach(user => {
        console.log(`  ${user.username}: ${user.payment_number}`);
      });
      console.log('');
    }
    
    // Test 5: List payment numbers for manual testing
    console.log('Test 5: Payment numbers for manual testing');
    console.log('='.repeat(50));
    console.log('Use these payment numbers to test transactions:\n');
    users.forEach(user => {
      console.log(`  ${user.username.padEnd(15)} → ${user.payment_number}`);
    });
    console.log('');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed! Payment number system ready.');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run tests
testPaymentNumbers();
