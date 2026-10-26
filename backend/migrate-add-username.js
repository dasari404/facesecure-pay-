const mysql = require('mysql2/promise');
require('dotenv').config();

async function addUsernameColumn() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nada'
    });
    
    console.log('✓ Connected to database');
    
    // Check if username column already exists
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM users LIKE 'username'
    `);
    
    if (columns.length > 0) {
      console.log('⚠ Username column already exists. Skipping migration.');
      return;
    }
    
    // Start transaction
    await connection.beginTransaction();
    console.log('✓ Transaction started');
    
    // Step 1: Add username column (nullable initially)
    await connection.query(`
      ALTER TABLE users 
      ADD COLUMN username VARCHAR(50) NULL AFTER id
    `);
    console.log('✓ Added username column');
    
    // Step 2: Generate usernames for existing users
    const [existingUsers] = await connection.query(`
      SELECT id, email FROM users WHERE username IS NULL
    `);
    
    console.log(`✓ Found ${existingUsers.length} users without username`);
    
    for (const user of existingUsers) {
      // Generate username from email prefix + random suffix
      const emailPrefix = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      const randomSuffix = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      const username = `${emailPrefix}_${randomSuffix}`;
      
      await connection.query(
        'UPDATE users SET username = ? WHERE id = ?',
        [username, user.id]
      );
      
      console.log(`  - Generated username "${username}" for user ${user.id}`);
    }
    
    // Step 3: Add UNIQUE constraint and index
    await connection.query(`
      ALTER TABLE users 
      ADD UNIQUE KEY idx_username (username)
    `);
    console.log('✓ Added unique constraint and index on username');
    
    // Commit transaction
    await connection.commit();
    console.log('✓ Migration completed successfully');
    
  } catch (error) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
      console.error('✗ Migration failed, rolled back transaction');
    }
    console.error('Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Rollback function
async function rollbackMigration() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nada'
    });
    
    console.log('✓ Connected to database');
    
    // Check if username column exists
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM users LIKE 'username'
    `);
    
    if (columns.length === 0) {
      console.log('⚠ Username column does not exist. Nothing to rollback.');
      return;
    }
    
    // Drop username column
    await connection.query(`
      ALTER TABLE users DROP COLUMN username
    `);
    
    console.log('✓ Rollback completed - username column dropped');
    
  } catch (error) {
    console.error('✗ Rollback failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run migration or rollback based on command line argument
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--rollback')) {
    rollbackMigration()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    addUsernameColumn()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { addUsernameColumn, rollbackMigration };
