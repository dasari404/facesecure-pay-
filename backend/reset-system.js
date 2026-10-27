const db = require('./config/database');

async function resetSystem() {
  try {
    console.log('\n🔄 RESETTING FACESECURE PAY SYSTEM...\n');
    
    // 1. Delete all transactions
    console.log('1️⃣ Deleting all transactions...');
    const [deleteResult] = await db.query('DELETE FROM transactions');
    console.log(`   ✅ Deleted ${deleteResult.affectedRows} transactions\n`);
    
    // 2. Reset all user balances to 1000
    console.log('2️⃣ Resetting all user balances to ₹1000...');
    const [updateResult] = await db.query('UPDATE users SET balance = 1000.00');
    console.log(`   ✅ Updated ${updateResult.affectedRows} user accounts\n`);
    
    // 3. Show current user states
    console.log('3️⃣ Current User Account Status:\n');
    const [users] = await db.query(`
      SELECT id, full_name, email, payment_number, balance, face_registered
      FROM users
      WHERE email IN ('alice@test.com', 'bob@test.com', 'saikiran082k@gmail.com')
      ORDER BY id
    `);
    
    console.table(users);
    
    console.log('\n✅ RESET COMPLETE!\n');
    console.log('All users now have:');
    console.log('  • Balance: ₹1000.00');
    console.log('  • Zero transactions');
    console.log('  • Face registrations: Preserved\n');
    
    console.log('🚀 Ready to test dual verification flow!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  }
}

resetSystem();
