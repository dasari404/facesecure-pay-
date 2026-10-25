const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');

// User registration
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().trim().isLength({ min: 10, max: 15 })
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
    
    const { email, password, full_name, phone } = req.body;
    
    // Check if user already exists
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
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert user with starting balance of ₹1000
    const [result] = await db.query(`
      INSERT INTO users 
      (email, password_hash, full_name, phone, balance)
      VALUES (?, ?, ?, ?, 1000.00)
    `, [email, password_hash, full_name, phone || null]);
    
    const userId = result.insertId;
    
    // Generate JWT
    const token = jwt.sign(
      { 
        id: userId, 
        email: email,
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
        email,
        full_name,
        phone,
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
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
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
      'SELECT id, email, full_name, phone, balance, face_registered, created_at, last_login FROM users WHERE id = ?',
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
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
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

// Search user by email (protected)
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query must be at least 3 characters' 
      });
    }
    
    // Search by email
    const [users] = await db.query(
      'SELECT id, full_name, email FROM users WHERE email = ? AND id != ?',
      [query, req.user.id]
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

module.exports = router;
