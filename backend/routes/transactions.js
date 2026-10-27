const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const { checkFraud } = require('../services/fraudDetection');

// Generate unique transaction ID
function generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TX${timestamp}${random}`;
}

// Create new transaction (send money)
router.post('/send', verifyToken, [
  body('recipientIdentifier').trim().isLength({ min: 1 }),
  body('amount').isFloat({ min: 1.00 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('transactionType').optional().isIn(['personal', 'business', 'bill'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }
    
    const { recipientIdentifier, amount, description, transactionType } = req.body;
    const senderId = req.user.id;
    
    // Normalize identifier for search
    const normalizedIdentifier = recipientIdentifier.trim().toLowerCase();
    const normalizedPhone = recipientIdentifier.replace(/[\s\-\+\(\)]/g, '');
    const isNumeric = /^\d+$/.test(recipientIdentifier.trim());
    
    // Check if it's a 10-digit payment number
    const isPaymentNumber = isNumeric && recipientIdentifier.trim().length === 10;
    
    let recipients;
    
    if (isPaymentNumber) {
      // Search by payment number
      [recipients] = await db.query(`
        SELECT id, username, full_name, email 
        FROM users 
        WHERE payment_number = ?
        AND account_status = 'active'
        LIMIT 1
      `, [recipientIdentifier.trim()]);
    } else {
      // Search by username, email, phone, or user ID (backward compatibility)
      const userId = isNumeric ? parseInt(recipientIdentifier.trim(), 10) : null;
      
      [recipients] = await db.query(`
        SELECT id, username, full_name, email 
        FROM users 
        WHERE (
          LOWER(username) = ? 
          OR LOWER(email) = ? 
          OR REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ?
          ${userId ? 'OR id = ?' : ''}
        )
        AND account_status = 'active'
        LIMIT 2
      `, userId 
        ? [normalizedIdentifier, normalizedIdentifier, `%${normalizedPhone}%`, userId]
        : [normalizedIdentifier, normalizedIdentifier, `%${normalizedPhone}%`]
      );
    }
    
    if (recipients.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: isPaymentNumber 
          ? 'Recipient not found with this payment number.' 
          : 'Recipient not found. Please use username, email, phone, payment number, or user ID.' 
      });
    }
    
    if (recipients.length > 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Multiple recipients found. Please be more specific.' 
      });
    }
    
    const recipient = recipients[0];
    
    // Prevent sending to self
    if (recipient.id === senderId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot send money to yourself' 
      });
    }
    
    // Check sender balance
    const [[sender]] = await db.query(
      'SELECT balance FROM users WHERE id = ?',
      [senderId]
    );
    
    const senderBalance = parseFloat(sender.balance);
    
    // Check pending transactions to prevent overdraft
    const [[{ totalPending }]] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as totalPending 
      FROM transactions 
      WHERE sender_id = ? AND status = 'pending'
    `, [senderId]);
    
    const pendingAmount = parseFloat(totalPending);
    const availableBalance = senderBalance - pendingAmount;
    
    if (availableBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance (including pending transactions)',
        currentBalance: senderBalance,
        pendingAmount: pendingAmount,
        availableBalance: availableBalance,
        requestedAmount: amount
      });
    }
    
    // Generate transaction ID
    const transactionId = generateTransactionId();
    
    // Create pending transaction (store original identifier in recipient_email field for audit)
    const [result] = await db.query(`
      INSERT INTO transactions 
      (transaction_id, sender_id, recipient_id, recipient_email, amount, description, transaction_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      transactionId,
      senderId,
      recipient.id,
      recipientIdentifier, // Store original identifier for audit trail
      amount,
      description || null,
      transactionType || 'personal'
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Transaction created, verification required',
      transactionId,
      id: result.insertId,
      amount: parseFloat(amount),
      recipient: {
        id: recipient.id,
        username: recipient.username,
        name: recipient.full_name,
        email: recipient.email
      },
      requiresVerification: true
    });
    
  } catch (error) {
    console.error('Transaction creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create transaction' 
    });
  }
});

// Check fraud for a transaction
router.post('/check', verifyToken, [
  body('transactionId').notEmpty()
], async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    // Get transaction
    const [transactions] = await db.query(
      'SELECT * FROM transactions WHERE transaction_id = ? AND sender_id = ?',
      [transactionId, req.user.id]
    );
    
    if (transactions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }
    
    const transaction = transactions[0];
    
    // Run fraud check
    const fraudResult = await checkFraud(
      transaction.sender_id,
      transaction.recipient_email,
      parseFloat(transaction.amount)
    );
    
    // Update transaction with fraud score
    await db.query(`
      UPDATE transactions 
      SET fraud_score = ?, fraud_check_result = ?, fraud_check_passed = ?
      WHERE id = ?
    `, [
      fraudResult.fraudScore,
      fraudResult.riskLevel,
      !fraudResult.shouldBlock,
      transaction.id
    ]);
    
    // If high risk, mark as cancelled
    if (fraudResult.shouldBlock) {
      await db.query(
        'UPDATE transactions SET status = "cancelled" WHERE id = ?',
        [transaction.id]
      );
    }
    
    res.json({
      success: true,
      fraudCheck: fraudResult,
      transactionStatus: fraudResult.shouldBlock ? 'cancelled' : 'pending'
    });
    
  } catch (error) {
    console.error('Fraud check error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fraud check failed' 
    });
  }
});

// Verify and complete transaction
router.post('/verify', verifyToken, [
  body('transactionId').notEmpty(),
  body('faceVerified').isBoolean(),
  body('livenessScore').optional().isFloat({ min: 0, max: 100 })
], async (req, res) => {
  console.log('=== VERIFICATION REQUEST START ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('User ID from token:', req.user?.id);
  console.log('User details:', JSON.stringify(req.user, null, 2));
  
  try {
    const { transactionId, faceVerified, livenessScore, verificationData } = req.body;
    
    console.log('Parsed request data:', {
      transactionId,
      faceVerified,
      livenessScore,
      verificationData
    });
    
    // Get transaction
    console.log('Querying transaction with:', { transactionId, userId: req.user.id });
    const [transactions] = await db.query(
      'SELECT * FROM transactions WHERE transaction_id = ? AND sender_id = ?',
      [transactionId, req.user.id]
    );
    
    console.log('Transaction query result:', JSON.stringify(transactions, null, 2));
    
    if (transactions.length === 0) {
      console.log('ERROR: Transaction not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }
    
    const transaction = transactions[0];
    console.log('Transaction found:', JSON.stringify(transaction, null, 2));
    
    // Check if transaction is still pending
    console.log('Checking transaction status:', transaction.status);
    if (transaction.status !== 'pending') {
      console.log('ERROR: Transaction not pending');
      return res.status(400).json({ 
        success: false, 
        message: `Transaction is already ${transaction.status}` 
      });
    }
    
    // Check if fraud check passed
    console.log('Fraud check passed flag:', transaction.fraud_check_passed);
    if (transaction.fraud_check_passed === 0) {
      console.log('ERROR: Transaction failed fraud check');
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction failed fraud check' 
      });
    }
    
    // Check verification criteria
    const livenessThreshold = 60;
    const verificationPassed = faceVerified && (livenessScore >= livenessThreshold);
    
    console.log('Verification check:', {
      faceVerified,
      livenessScore,
      livenessThreshold,
      verificationPassed
    });
    
    if (!verificationPassed) {
      console.log('ERROR: Verification criteria not met');
      // Increment verification attempts
      await db.query(
        'UPDATE transactions SET verification_attempts = verification_attempts + 1, status = "failed" WHERE id = ?',
        [transaction.id]
      );
      
      return res.status(400).json({ 
        success: false, 
        message: 'Verification failed. Face match or liveness check did not pass.',
        faceVerified,
        livenessScore,
        livenessThreshold
      });
    }
    
    console.log('Verification passed, starting database transaction...');
    
    // Start database transaction for atomic balance update
    const connection = await db.getConnection();
    
    try {
      console.log('Beginning database transaction...');
      await connection.beginTransaction();
      
      // Lock the transaction row to prevent concurrent verification
      console.log('Acquiring transaction lock...');
      const [transactions] = await connection.query(
        'SELECT * FROM transactions WHERE transaction_id = ? AND sender_id = ? FOR UPDATE',
        [transactionId, req.user.id]
      );
      
      console.log('Lock acquired, transactions:', JSON.stringify(transactions, null, 2));
      
      if (transactions.length === 0) {
        console.log('ERROR: Transaction not found after lock');
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false, 
          message: 'Transaction not found or already processed' 
        });
      }
      
      const lockedTransaction = transactions[0];
      
      // Double-check status after acquiring lock
      console.log('Locked transaction status:', lockedTransaction.status);
      if (lockedTransaction.status !== 'pending') {
        console.log('ERROR: Transaction status changed after lock');
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: `Transaction is already ${lockedTransaction.status}` 
        });
      }
      
      // Deduct from sender
      console.log('Deducting from sender:', { amount: transaction.amount, senderId: transaction.sender_id });
      await connection.query(
        'UPDATE users SET balance = balance - ? WHERE id = ?',
        [transaction.amount, transaction.sender_id]
      );
      
      // Add to recipient
      console.log('Adding to recipient:', { amount: transaction.amount, recipientId: transaction.recipient_id });
      await connection.query(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [transaction.amount, transaction.recipient_id]
      );
      
      // Update transaction as completed
      console.log('Updating transaction status to completed...');
      await connection.query(`
        UPDATE transactions 
        SET status = 'completed', 
            face_verified = TRUE, 
            liveness_verified = TRUE,
            liveness_score = ?,
            completed_at = NOW()
        WHERE id = ?
      `, [livenessScore || 0, transaction.id]);
      
      console.log('Committing transaction...');
      await connection.commit();
      
      // Get updated balances
      console.log('Fetching updated balances...');
      const [[senderUpdated]] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [transaction.sender_id]
      );
      
      const [[recipientUpdated]] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [transaction.recipient_id]
      );
      
      console.log('Updated balances:', {
        senderBalance: senderUpdated?.balance,
        recipientBalance: recipientUpdated?.balance
      });
      
      connection.release();
      
      console.log('=== VERIFICATION SUCCESS ===');
      res.json({
        success: true,
        message: 'Transaction completed successfully',
        transaction: {
          id: transaction.id,
          transactionId: transaction.transaction_id,
          amount: parseFloat(transaction.amount),
          status: 'completed',
          senderBalance: parseFloat(senderUpdated.balance),
          recipientBalance: parseFloat(recipientUpdated.balance)
        }
      });
      
    } catch (txError) {
      console.error('DATABASE TRANSACTION ERROR:', txError);
      console.error('Stack trace:', txError.stack);
      await connection.rollback();
      connection.release();
      throw txError;
    }
    
  } catch (error) {
    console.error('=== VERIFICATION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Return safe error message based on error type
    let errorMessage = 'An unexpected error occurred during verification';
    let statusCode = 500;
    
    if (error.code === 'ER_DUP_ENTRY') {
      errorMessage = 'Transaction already processed';
      statusCode = 409;
    } else if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
      errorMessage = 'Transaction is being processed. Please try again.';
      statusCode = 503;
    } else if (error.message && error.message.includes('balance')) {
      errorMessage = 'Insufficient balance to complete transaction';
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      message: errorMessage
    });
  }
});

// Get transaction history
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const type = req.query.type; // 'sent', 'received', or 'all'
    const status = req.query.status;
    
    let whereConditions = [];
    let params = [userId, userId];
    
    if (type === 'sent') {
      whereConditions.push('t.sender_id = ?');
      params = [userId];
    } else if (type === 'received') {
      whereConditions.push('t.recipient_id = ?');
      params = [userId];
    } else {
      whereConditions.push('(t.sender_id = ? OR t.recipient_id = ?)');
    }
    
    if (status) {
      whereConditions.push('t.status = ?');
      params.push(status);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Get total count
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM transactions t WHERE ${whereClause}`,
      params
    );
    
    // Get transactions with user details
    const [transactions] = await db.query(`
      SELECT 
        t.*,
        sender.full_name as sender_name,
        sender.email as sender_email,
        recipient.full_name as recipient_name,
        recipient.email as recipient_email
      FROM transactions t
      JOIN users sender ON t.sender_id = sender.id
      JOIN users recipient ON t.recipient_id = recipient.id
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    // Format transactions
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      transactionId: tx.transaction_id,
      amount: parseFloat(tx.amount),
      description: tx.description,
      type: tx.sender_id === userId ? 'sent' : 'received',
      status: tx.status,
      transactionType: tx.transaction_type,
      sender: {
        id: tx.sender_id,
        name: tx.sender_name,
        email: tx.sender_email
      },
      recipient: {
        id: tx.recipient_id,
        name: tx.recipient_name,
        email: tx.recipient_email
      },
      fraudScore: tx.fraud_score,
      faceVerified: tx.face_verified,
      livenessVerified: tx.liveness_verified,
      createdAt: tx.created_at,
      completedAt: tx.completed_at
    }));
    
    res.json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transaction history' 
    });
  }
});

// Get pending receipts (transactions awaiting recipient verification)
// IMPORTANT: This route must come BEFORE /:id to avoid matching "pending-receipts" as an ID
router.get('/pending-receipts', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('=== PENDING RECEIPTS REQUEST ===');
    console.log('Fetching pending receipts for userId:', userId);

    const [transactions] = await db.query(`
      SELECT 
        t.*,
        sender.full_name as sender_name,
        sender.email as sender_email,
        sender.payment_number as sender_payment_number,
        sender.username as sender_username
      FROM transactions t
      JOIN users sender ON t.sender_id = sender.id
      WHERE t.recipient_id = ?
        AND t.sender_verified = TRUE
        AND t.recipient_verified = FALSE
        AND t.status = 'pending'
      ORDER BY t.sender_verification_time DESC
    `, [userId]);

    console.log('Found', transactions.length, 'pending receipts');
    if (transactions.length > 0) {
      console.log('First transaction:', {
        transaction_id: transactions[0].transaction_id,
        sender_name: transactions[0].sender_name,
        amount: transactions[0].amount,
        sender_verified: transactions[0].sender_verified,
        recipient_verified: transactions[0].recipient_verified
      });
    }

    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      transaction_id: tx.transaction_id,
      amount: parseFloat(tx.amount),
      description: tx.description,
      transaction_type: tx.transaction_type,
      verification_stage: tx.verification_stage,
      sender_id: tx.sender_id,
      sender_name: tx.sender_name,
      sender_username: tx.sender_username,
      sender_payment_number: tx.sender_payment_number,
      sender_email: tx.sender_email,
      sender_verified_at: tx.sender_verification_time,
      created_at: tx.created_at,
      waiting_time_minutes: Math.round((Date.now() - new Date(tx.sender_verification_time || tx.created_at).getTime()) / 60000)
    }));

    res.json({
      success: true,
      transactions: formattedTransactions,
      count: formattedTransactions.length,
      totalAmount: formattedTransactions.reduce((sum, tx) => sum + tx.amount, 0)
    });

  } catch (error) {
    console.error('Pending receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending receipts'
    });
  }
});

// Get single transaction details
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [transactions] = await db.query(`
      SELECT 
        t.*,
        sender.full_name as sender_name,
        sender.email as sender_email,
        recipient.full_name as recipient_name,
        recipient.email as recipient_email
      FROM transactions t
      JOIN users sender ON t.sender_id = sender.id
      JOIN users recipient ON t.recipient_id = recipient.id
      WHERE t.transaction_id = ? AND (t.sender_id = ? OR t.recipient_id = ?)
    `, [id, req.user.id, req.user.id]);
    
    if (transactions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }
    
    const tx = transactions[0];
    
    res.json({
      success: true,
      transaction: {
        id: tx.id,
        transactionId: tx.transaction_id,
        amount: parseFloat(tx.amount),
        description: tx.description,
        type: tx.sender_id === req.user.id ? 'sent' : 'received',
        status: tx.status,
        transactionType: tx.transaction_type,
        sender: {
          id: tx.sender_id,
          name: tx.sender_name,
          email: tx.sender_email
        },
        recipient: {
          id: tx.recipient_id,
          name: tx.recipient_name,
          email: tx.recipient_email
        },
        fraudScore: tx.fraud_score,
        fraudCheckResult: tx.fraud_check_result,
        faceVerified: tx.face_verified,
        livenessVerified: tx.liveness_verified,
        livenessScore: tx.liveness_score,
        verificationAttempts: tx.verification_attempts,
        createdAt: tx.created_at,
        completedAt: tx.completed_at
      }
    });
    
  } catch (error) {
    console.error('Transaction fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transaction' 
    });
  }
});

// Verify sender (Phase 1 of dual verification)
router.post('/verify-sender', verifyToken, [
  body('transactionId').notEmpty(),
  body('faceVerified').isBoolean(),
  body('livenessScore').optional().isFloat({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const { transactionId, faceVerified, livenessScore } = req.body;
    const userId = req.user.id;

    console.log('=== VERIFY SENDER REQUEST ===');
    console.log('Transaction ID:', transactionId);
    console.log('User ID:', userId);
    console.log('Face Verified:', faceVerified);
    console.log('Liveness Score:', livenessScore);

    // Get transaction - must be sender
    const [transactions] = await db.query(
      'SELECT * FROM transactions WHERE transaction_id = ? AND sender_id = ?',
      [transactionId, userId]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or you are not the sender'
      });
    }

    const transaction = transactions[0];

    // Check transaction is still pending
    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Transaction is already ${transaction.status}`
      });
    }

    // Check if sender already verified
    if (transaction.sender_verified) {
      return res.status(400).json({
        success: false,
        message: 'Sender has already verified this transaction'
      });
    }

    // Check if fraud check passed
    if (transaction.fraud_check_passed === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transaction failed fraud check'
      });
    }

    // Verify sender has registered face
    const [[senderFace]] = await db.query(
      'SELECT id, face_photo FROM face_registrations WHERE user_id = ? AND is_active = TRUE',
      [userId]
    );

    if (!senderFace) {
      return res.status(400).json({
        success: false,
        message: 'Please register your face photo before making transactions',
        requiresFaceRegistration: true
      });
    }

    if (!senderFace.face_photo) {
      return res.status(400).json({
        success: false,
        message: 'Face photo not found. Please re-register your face',
        requiresFaceRegistration: true
      });
    }

    // Verify face and liveness
    const livenessThreshold = 60;
    const verificationPassed = faceVerified && (livenessScore >= livenessThreshold);

    if (!verificationPassed) {
      await db.query(
        'UPDATE transactions SET verification_attempts = verification_attempts + 1 WHERE id = ?',
        [transaction.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Sender verification failed. Face match or liveness check did not pass.',
        faceVerified,
        livenessScore,
        livenessThreshold
      });
    }

    // Update transaction - mark sender as verified
    await db.query(`
      UPDATE transactions 
      SET sender_verified = TRUE,
          sender_verification_time = NOW(),
          verification_stage = 'pending_recipient',
          liveness_score = ?
      WHERE id = ?
    `, [livenessScore || 0, transaction.id]);

    // Get recipient details
    const [[recipient]] = await db.query(
      'SELECT id, full_name, email, payment_number FROM users WHERE id = ?',
      [transaction.recipient_id]
    );

    res.json({
      success: true,
      message: 'Sender verified successfully. Waiting for recipient verification.',
      transaction: {
        id: transaction.id,
        transactionId: transaction.transaction_id,
        amount: parseFloat(transaction.amount),
        status: 'pending',
        verificationStage: 'pending_recipient',
        senderVerified: true,
        recipientVerified: false
      },
      recipient: {
        name: recipient.full_name,
        paymentNumber: recipient.payment_number
      },
      nextStep: 'Recipient must verify to complete the transaction'
    });

  } catch (error) {
    console.error('Sender verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify sender'
    });
  }
});

// Verify recipient (Phase 2 of dual verification - completes payment)
router.post('/verify-recipient', verifyToken, [
  body('transactionId').notEmpty(),
  body('faceVerified').isBoolean(),
  body('livenessScore').optional().isFloat({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const { transactionId, faceVerified, livenessScore } = req.body;
    const userId = req.user.id;

    console.log('=== VERIFY RECIPIENT REQUEST ===');
    console.log('Transaction ID:', transactionId);
    console.log('User ID (Recipient):', userId);
    console.log('Face Verified:', faceVerified);
    console.log('Liveness Score:', livenessScore);

    // Get transaction - must be recipient
    const [transactions] = await db.query(
      'SELECT * FROM transactions WHERE transaction_id = ? AND recipient_id = ?',
      [transactionId, userId]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or you are not the recipient'
      });
    }

    const transaction = transactions[0];

    // Check transaction is still pending
    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Transaction is already ${transaction.status}`
      });
    }

    // Check if sender has verified first
    if (!transaction.sender_verified) {
      return res.status(400).json({
        success: false,
        message: 'Sender must verify first before recipient can accept',
        senderVerified: false
      });
    }

    // Check if recipient already verified
    if (transaction.recipient_verified) {
      return res.status(400).json({
        success: false,
        message: 'Recipient has already verified this transaction'
      });
    }

    // Verify recipient has registered face
    const [[recipientFace]] = await db.query(
      'SELECT id, face_photo FROM face_registrations WHERE user_id = ? AND is_active = TRUE',
      [userId]
    );

    if (!recipientFace) {
      return res.status(400).json({
        success: false,
        message: 'Please register your face photo before receiving payments',
        requiresFaceRegistration: true
      });
    }

    if (!recipientFace.face_photo) {
      return res.status(400).json({
        success: false,
        message: 'Face photo not found. Please re-register your face',
        requiresFaceRegistration: true
      });
    }

    // Verify face and liveness
    const livenessThreshold = 60;
    const verificationPassed = faceVerified && (livenessScore >= livenessThreshold);

    if (!verificationPassed) {
      await db.query(
        'UPDATE transactions SET verification_attempts = verification_attempts + 1 WHERE id = ?',
        [transaction.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Recipient verification failed. Face match or liveness check did not pass.',
        faceVerified,
        livenessScore,
        livenessThreshold
      });
    }

    // Start database transaction for atomic balance update
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Lock the transaction row
      const [lockedTransactions] = await connection.query(
        'SELECT * FROM transactions WHERE transaction_id = ? FOR UPDATE',
        [transactionId]
      );

      if (lockedTransactions.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Transaction not found or already processed'
        });
      }

      const lockedTx = lockedTransactions[0];

      // Double-check status after lock
      if (lockedTx.status !== 'pending') {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Transaction is already ${lockedTx.status}`
        });
      }

      // Deduct from sender
      await connection.query(
        'UPDATE users SET balance = balance - ? WHERE id = ?',
        [transaction.amount, transaction.sender_id]
      );

      // Add to recipient
      await connection.query(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [transaction.amount, transaction.recipient_id]
      );

      // Update transaction as completed with both verifications
      await connection.query(`
        UPDATE transactions 
        SET status = 'completed',
            recipient_verified = TRUE,
            recipient_verification_time = NOW(),
            verification_stage = 'both_verified',
            face_verified = TRUE,
            liveness_verified = TRUE,
            completed_at = NOW()
        WHERE id = ?
      `, [transaction.id]);

      await connection.commit();

      // Get updated balances
      const [[senderUpdated]] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [transaction.sender_id]
      );

      const [[recipientUpdated]] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [transaction.recipient_id]
      );

      connection.release();

      res.json({
        success: true,
        message: 'Payment completed successfully! Both parties verified.',
        transaction: {
          id: transaction.id,
          transactionId: transaction.transaction_id,
          amount: parseFloat(transaction.amount),
          status: 'completed',
          verificationStage: 'both_verified',
          senderVerified: true,
          recipientVerified: true,
          senderBalance: parseFloat(senderUpdated.balance),
          recipientBalance: parseFloat(recipientUpdated.balance)
        }
      });

    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }

  } catch (error) {
    console.error('Recipient verification error:', error);
    
    let errorMessage = 'Failed to verify recipient';
    let statusCode = 500;

    if (error.code === 'ER_DUP_ENTRY') {
      errorMessage = 'Transaction already processed';
      statusCode = 409;
    } else if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
      errorMessage = 'Transaction is being processed. Please try again.';
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
  }
});

module.exports = router;
