require('dotenv').config();
const jwt = require('jsonwebtoken');

// Create a test JWT token
const testPayload = {
    email: "test@example.com",
    tokens: {
        access_token: "test_access_token",
        refresh_token: "test_refresh_token"
    }
};

// Sign the token with the same secret used in the controller
const token = jwt.sign(testPayload, process.env.JWT_SECRET);
console.log('Generated JWT Token:', token);

// Now verify it (same process as in the controller)
try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT payload:', decoded);
} catch (err) {
    console.error('Token verification failed:', err.message);
} 