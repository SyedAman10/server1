const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    // Get token from either cookie or Authorization header
    let token = req.cookies.jwt;
    
    if (!token && req.headers.authorization) {
      // Extract token from Bearer token in Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
    }
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user info to request
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticate }; 