const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');

// Generate unique random 10-digit payment number
function generatePaymentNumber() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Generate unique payment number with collision check
async function generateUniquePaymentNumber() {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const paymentNumber = generatePaymentNumber();
    
    // Check if number already exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE payment_number = ?',
      [paymentNumber]
    );
    
    if (existing.length === 0) {
      return paymentNumber;
    }
  }
  
  throw new Error('Failed to generate unique payment number after multiple attempts');
}

// User registration
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').trim().isLength({ min: 2, max: 100 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ min: 10, max: 15 }),
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/)
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
    
    const { email, password, full_name, phone, username } = req.body;
    
    // Validate phone is provided (now required)
    if (!phone || phone.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }
    
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    // Normalize username to lowercase for case-insensitive uniqueness
    const normalizedUsername = username.toLowerCase();
    
    // Check if email already exists
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }
    
    // Check if username already exists (case-insensitive)
    const [existingUsername] = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
      [normalizedUsername]
    );
    
    if (existingUsername.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already taken' 
      });
    }
    
    // Check if phone number already exists
    const [existingPhone] = await db.query(
      'SELECT id FROM users WHERE payment_number = ?',
      [normalizedPhone]
    );
    
    if (existingPhone.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number already registered' 
      });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Use phone number as payment number (no random generation)
    const paymentNumber = normalizedPhone;
    
    // Insert user with starting balance of ₹1000
    const [result] = await db.query(`
      INSERT INTO users 
      (username, email, password_hash, full_name, phone, payment_number, balance)
      VALUES (?, ?, ?, ?, ?, ?, 1000.00)
    `, [normalizedUsername, email, password_hash, full_name, phone, paymentNumber]);
    
    const userId = result.insertId;
    
    // Generate JWT
    const token = jwt.sign(
      { 
        id: userId, 
        email: email,
        username: normalizedUsername,
        isAdmin: false 
      },
      process.env.JWT_SECRET || 'facesecure-dev-secret-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: userId,
        username: normalizedUsername,
        email,
        full_name,
        phone,
        payment_number: paymentNumber,
        balance: 1000.00
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
});

// User login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
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
    
    const { email, password } = req.body;
    
    // Get user from database
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    const user = users[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );
    
    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        username: user.username,
        isAdmin: false 
      },
      process.env.JWT_SECRET || 'facesecure-dev-secret-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        payment_number: user.payment_number,
        balance: parseFloat(user.balance),
        face_registered: user.face_registered
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// Get user profile (protected)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, full_name, phone, payment_number, balance, face_registered, created_at, last_login FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = users[0];
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        payment_number: user.payment_number,
        balance: parseFloat(user.balance),
        face_registered: user.face_registered,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch profile' 
    });
  }
});

// Search user by username, email, phone, or user ID (protected)
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }
    
    // Check if query is numeric (potential user ID) - allow shorter queries for IDs
    const isNumeric = /^\d+$/.test(query.trim());
    
    // For non-numeric queries, require at least 3 characters
    if (!isNumeric && query.trim().length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query must be at least 3 characters' 
      });
    }
    
    // Normalize query
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedPhone = query.replace(/[\s\-\+\(\)]/g, ''); // Remove spaces, dashes, plus, parentheses
    const userId = isNumeric ? parseInt(query, 10) : null;
    
    // Build SQL query with OR conditions for multi-field search
    const [users] = await db.query(`
      SELECT id, username, full_name, email, phone 
      FROM users 
      WHERE (
        LOWER(username) = ? 
        OR LOWER(email) = ? 
        OR REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ?
        ${userId ? 'OR id = ?' : ''}
      )
      AND id != ? 
      AND account_status = 'active'
      LIMIT 10
    `, userId 
      ? [normalizedQuery, normalizedQuery, `%${normalizedPhone}%`, userId, req.user.id]
      : [normalizedQuery, normalizedQuery, `%${normalizedPhone}%`, req.user.id]
    );
    
    res.json({
      success: true,
      users
    });
    
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Search failed' 
    });
  }
});

// Get user by payment number (protected)
router.get('/payment-number', verifyToken, async (req, res) => {
  try {
    const { number } = req.query;
    
    if (!number || !number.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment number is required' 
      });
    }
    
    // Validate payment number format (exactly 10 digits)
    if (!/^\d{10}$/.test(number.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment number must be exactly 10 digits' 
      });
    }
    
    // Search for user by payment number
    const [users] = await db.query(`
      SELECT id, username, full_name, email, payment_number
      FROM users 
      WHERE payment_number = ?
      AND id != ? 
      AND account_status = 'active'
    `, [number.trim(), req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found with this payment number' 
      });
    }
    
    const user = users[0];
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        payment_number: user.payment_number
      }
    });
    
  } catch (error) {
    console.error('Payment number lookup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Payment number lookup failed' 
    });
  }
});

module.exports = router;
