const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import database to test connection
require('./config/database');

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://127.0.0.1:5500', 'http://localhost:5500'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  message: { 
    success: false, 
    message: 'Too many requests, please try again later' 
  }
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'FaceSecure Pay API is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/auth'));
app.use('/api/face', require('./routes/face'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/fraud', require('./routes/transactions'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          🔐 FaceSecure Pay API Server                    ║
║                                                           ║
║  Server running on: http://localhost:${PORT}              ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                   ║
║                                                           ║
║  Endpoints:                                               ║
║  • GET  /health                                          ║
║  • POST /api/auth/register                               ║
║  • POST /api/auth/login                                  ║
║  • GET  /api/user/profile                                ║
║  • GET  /api/user/search                                 ║
║  • POST /api/transactions/send                           ║
║  • POST /api/transactions/verify                         ║
║  • POST /api/fraud/check                                 ║
║  • GET  /api/transactions                                ║
║  • POST /api/admin/login                                 ║
║  • POST /api/reports/submit                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
