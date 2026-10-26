// Migration Script: Add payment_number column to users table
// Run: node backend/migrate-add-payment-number.js

const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

// Generate unique random 10-digit payment number
function generatePaymentNumber() {
  // Range: 1000000000 to 9999999999
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

async function migrate() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nada'
    });
    
    console.log('Connected to database');
    
    // Check if payment_number column already exists
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'payment_number'"
    );
    
    if (columns.length > 0) {
      console.log('payment_number column already exists. Skipping migration.');
      return;
    }
    
    // Add payment_number column
    console.log('Adding payment_number column to users table...');
    await connection.query(`
      ALTER TABLE users 
      ADD COLUMN payment_number VARCHAR(10) UNIQUE NULL
      AFTER phone
    `);
    console.log('✓ Column added');
    
    // Get existing users
    const [users] = await connection.query('SELECT id, username FROM users');
    console.log(`Found ${users.length} existing users`);
    
    // Generate unique payment numbers for existing users
    for (const user of users) {
      let paymentNumber;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      // Retry until we get a unique number
      while (!isUnique && attempts < maxAttempts) {
        paymentNumber = generatePaymentNumber();
        
        // Check if number already exists
        const [existing] = await connection.query(
          'SELECT id FROM users WHERE payment_number = ?',
          [paymentNumber]
        );
        
        if (existing.length === 0) {
          isUnique = true;
        } else {
          attempts++;
          console.log(`  Collision detected for ${paymentNumber}, retrying...`);
        }
      }
      
      if (!isUnique) {
        throw new Error(`Failed to generate unique payment number for user ${user.id} after ${maxAttempts} attempts`);
      }
      
      // Update user with payment number
      await connection.query(
        'UPDATE users SET payment_number = ? WHERE id = ?',
        [paymentNumber, user.id]
      );
      
      console.log(`✓ Generated payment number ${paymentNumber} for user ${user.username} (ID: ${user.id})`);
    }
    
    // Make payment_number NOT NULL now that all users have values
    console.log('Making payment_number column NOT NULL...');
    await connection.query(`
      ALTER TABLE users 
      MODIFY COLUMN payment_number VARCHAR(10) UNIQUE NOT NULL
    `);
    console.log('✓ Column made NOT NULL');
    
    // Add index for better query performance
    console.log('Adding index on payment_number...');
    await connection.query(`
      CREATE INDEX idx_payment_number ON users(payment_number)
    `);
    console.log('✓ Index added');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nVerify the changes with:');
    console.log('mysql -u root -p nada -e "SELECT id, username, payment_number FROM users;"');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run migration
migrate();
