const db = require('../config/database');

/**
 * Fraud detection scoring algorithm
 * Calculates fraud risk based on multiple factors
 * 
 * Scoring breakdown:
 * - High amount relative to balance (>50%): +30 points
 * - High transaction frequency (>5 in 1 hour): +25 points
 * - New recipient (never sent before): +15 points
 * - Unusual time (2 AM - 5 AM): +10 points
 * - High absolute amount (>₹10,000): +20 points
 * 
 * Risk levels:
 * - LOW_RISK: 0-39 points
 * - MEDIUM_RISK: 40-69 points
 * - HIGH_RISK: 70+ points (transaction blocked)
 */
async function checkFraud(userId, recipientEmail, amount) {
  try {
    let fraudScore = 0;
    const details = {};
    
    // Get user balance
    const [[user]] = await db.query(
      'SELECT balance FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const balance = parseFloat(user.balance);
    
    // Factor 1: Amount > 50% of balance
    if (amount > balance * 0.5) {
      fraudScore += 30;
      details.highAmountRatio = true;
    }
    
    // Factor 2: High frequency - check transactions in last hour
    const [[{ recentCount }]] = await db.query(
      'SELECT COUNT(*) as recentCount FROM transactions WHERE sender_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
      [userId]
    );
    
    if (recentCount > 5) {
      fraudScore += 25;
      details.highFrequency = true;
      details.recentTransactionCount = recentCount;
    }
    
    // Factor 3: New recipient - check if user has sent money to this recipient before
    const [recipientUser] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [recipientEmail]
    );
    
    if (recipientUser.length > 0) {
      const recipientId = recipientUser[0].id;
      
      const [[{ sentBefore }]] = await db.query(
        'SELECT COUNT(*) as sentBefore FROM transactions WHERE sender_id = ? AND recipient_id = ? AND status = "completed"',
        [userId, recipientId]
      );
      
      if (sentBefore === 0) {
        fraudScore += 15;
        details.newRecipient = true;
      }
    }
    
    // Factor 4: Unusual time (2 AM - 5 AM)
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 5) {
      fraudScore += 10;
      details.unusualTime = true;
      details.transactionHour = hour;
    }
    
    // Factor 5: High absolute amount (>₹10,000)
    if (amount > 10000) {
      fraudScore += 20;
      details.highAbsoluteAmount = true;
    }
    
    // Determine risk level
    let riskLevel;
    if (fraudScore >= 70) {
      riskLevel = 'HIGH_RISK';
    } else if (fraudScore >= 40) {
      riskLevel = 'MEDIUM_RISK';
    } else {
      riskLevel = 'LOW_RISK';
    }
    
    return {
      fraudScore,
      riskLevel,
      shouldBlock: fraudScore >= 70,
      details,
      recommendation: fraudScore >= 70 
        ? 'Transaction blocked due to high fraud risk'
        : fraudScore >= 40
        ? 'Additional verification recommended'
        : 'Transaction approved'
    };
    
  } catch (error) {
    console.error('Fraud detection error:', error);
    throw error;
  }
}

module.exports = {
  checkFraud
};
