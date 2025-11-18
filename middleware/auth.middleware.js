const jwt = require('jsonwebtoken');
const { getUserById } = require('../models/user.model');

const authenticate = async (req, res, next) => {
  try {
    // Get token from either cookie or Authorization header
    let token = req.cookies?.jwt;
    
    if (!token && req.headers.authorization) {
      // Extract token from Bearer token in Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'No token provided' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // If token has user ID, fetch fresh user data from database
    if (decoded.id) {
      const user = await getUserById(decoded.id);
      if (!user) {
        return res.status(401).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      // Attach user info to request (without password)
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        picture: user.picture
      };
    } else {
      // For backward compatibility with old tokens
      req.user = {
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        picture: decoded.picture
      };
    }
    
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({ 
      success: false,
      error: 'Invalid token' 
    });
  }
};

// Middleware to check if user has required role
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }
    
    next();
  };
};

module.exports = { authenticate, requireRole }; 