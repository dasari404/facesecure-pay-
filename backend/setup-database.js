const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  let connection;
  
  try {
    // Connect to MySQL without selecting a database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });
    
    console.log('✅ Connected to MySQL');
    
    // Use the existing database
    const dbName = process.env.DB_NAME || 'nada';
    await connection.query(`USE ${dbName}`);
    console.log(`✅ Using database '${dbName}'`);
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'config', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema (will drop and recreate tables)
    await connection.query(schema);
    console.log('✅ Database schema created successfully');
    
    // Verify tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`✅ Created ${tables.length} tables:`);
    tables.forEach(table => {
      const tableName = table[`Tables_in_${dbName}`];
      console.log(`   - ${tableName}`);
    });
    
    console.log('\n✨ Database setup complete!');
    console.log('\nDefault admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n⚠️  Remember to change these in production!\n');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run setup
setupDatabase();
