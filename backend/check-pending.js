const db = require('./config/database');

async function checkPending() {
  try {
    console.log('\n=== CHECKING PENDING TRANSACTIONS ===\n');
    
    // Get naka's user ID first
    const [[naka]] = await db.query("SELECT id, full_name, email FROM users WHERE email = 'saikiran082k@gmail.com'");
    console.log('Naka user:', naka);
    
    if (!naka) {
      console.log('Naka user not found!');
      return;
    }
    
    console.log('\n--- All Pending Transactions ---');
    const [allPending] = await db.query(`
      SELECT t.id, t.transaction_id, t.amount, t.status, 
             t.sender_verified, t.recipient_verified, t.verification_stage,
             t.sender_id, t.recipient_id,
             s.full_name as sender_name, r.full_name as recipient_name
      FROM transactions t
      JOIN users s ON t.sender_id = s.id
      JOIN users r ON t.recipient_id = r.id
      WHERE t.status = 'pending'
      ORDER BY t.created_at DESC
    `);
    console.table(allPending);
    
    console.log('\n--- Pending Receipts for Naka (recipient_id = ' + naka.id + ') ---');
    const [nakaReceipts] = await db.query(`
      SELECT t.id, t.transaction_id, t.amount, t.status,
             t.sender_verified, t.recipient_verified, t.verification_stage,
             s.full_name as sender_name
      FROM transactions t
      JOIN users s ON t.sender_id = s.id
      WHERE t.recipient_id = ?
        AND t.status = 'pending'
      ORDER BY t.created_at DESC
    `, [naka.id]);
    
    console.log('Count:', nakaReceipts.length);
    console.table(nakaReceipts);
    
    console.log('\n--- With All Filters (like backend endpoint) ---');
    const [filtered] = await db.query(`
      SELECT t.id, t.transaction_id, t.amount, t.status,
             t.sender_verified, t.recipient_verified, t.verification_stage,
             s.full_name as sender_name
      FROM transactions t
      JOIN users s ON t.sender_id = s.id
      WHERE t.recipient_id = ?
        AND t.sender_verified = TRUE
        AND t.recipient_verified = FALSE
        AND t.status = 'pending'
      ORDER BY t.sender_verification_time DESC
    `, [naka.id]);
    
    console.log('Count with filters:', filtered.length);
    console.table(filtered);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPending();
