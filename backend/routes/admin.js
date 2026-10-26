const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password required' 
      });
    }
    
    // Get admin from database
    const [admins] = await db.query(
      'SELECT * FROM admins WHERE username = ? AND is_active = TRUE',
      [username]
    );
    
    if (admins.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    const admin = admins[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Update last login
    await db.query(
      'UPDATE admins SET last_login = NOW() WHERE id = ?',
      [admin.id]
    );
    
    // Generate JWT
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username,
        role: admin.role,
        isAdmin: true 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role
      }
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// Get dashboard stats (protected)
router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Get total users
    const [[{ total_users }]] = await db.query(
      'SELECT COUNT(*) as total_users FROM users'
    );
    
    // Get active users (logged in last 30 days)
    const [[{ active_users }]] = await db.query(
      'SELECT COUNT(*) as active_users FROM users WHERE last_login > DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    
    // Get total transactions
    const [[{ total_transactions }]] = await db.query(
      'SELECT COUNT(*) as total_transactions FROM transactions'
    );
    
    // Get today's transactions
    const [[{ today_transactions }]] = await db.query(
      'SELECT COUNT(*) as today_transactions FROM transactions WHERE DATE(created_at) = CURDATE()'
    );
    
    // Get transaction volume
    const [[{ transaction_volume }]] = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as transaction_volume FROM transactions WHERE status = "completed"'
    );
    
    // Get pending reports
    const [[{ pending_reports }]] = await db.query(
      'SELECT COUNT(*) as pending_reports FROM user_reports WHERE status IN ("submitted", "under_review")'
    );
    
    // Get fraud alerts
    const [[{ fraud_alerts }]] = await db.query(
      'SELECT COUNT(*) as fraud_alerts FROM user_reports WHERE report_type = "fraud" AND status != "resolved"'
    );
    
    res.json({
      success: true,
      stats: {
        users: {
          total: parseInt(total_users),
          active: parseInt(active_users)
        },
        transactions: {
          total: parseInt(total_transactions),
          today: parseInt(today_transactions),
          volume: parseFloat(transaction_volume)
        },
        reports: {
          pending: parseInt(pending_reports),
          fraud_alerts: parseInt(fraud_alerts)
        }
      }
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stats' 
    });
  }
});

// Get recent activity
router.get('/activity', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const [activities] = await db.query(`
      SELECT 
        t.id,
        t.transaction_id,
        t.amount,
        t.status,
        t.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.payment_number as user_payment_number
      FROM transactions t
      JOIN users u ON t.sender_id = u.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `, [limit]);
    
    res.json({
      success: true,
      activities
    });
    
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch activity' 
    });
  }
});

module.exports = router;
