const jwt = require('jsonwebtoken');

// Verify JWT token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(403).json({ 
      success: false, 
      message: 'No token provided' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'facesecure-dev-secret-change-in-production');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Verify admin role
const verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

// Optional auth (doesn't block if no token)
const optionalAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'facesecure-dev-secret-change-in-production');
      req.user = decoded;
    } catch (error) {
      // Invalid token but don't block request
      req.user = null;
    }
  }
  next();
};

module.exports = {
  verifyToken,
  verifyAdmin,
  optionalAuth
};
