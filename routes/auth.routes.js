const express = require('express');
const { 
  getAuthUrl, 
  handleWebAuth, 
  handleMobileAuth, 
  handleMobileCallback, 
  logDeepLinkInteraction, 
  testDeepLink,
  signup,
  login,
  getCurrentUser
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Authentication endpoints (email/password)
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);

// Web flow endpoints (OAuth)
router.get('/google', getAuthUrl);
router.get('/google/callback', handleWebAuth);

// Mobile flow endpoints (OAuth)
router.post('/google/mobile', handleMobileAuth);
router.get('/google/mobile-callback', handleMobileCallback);

// Deep link logging endpoint
router.post('/log-deep-link', logDeepLinkInteraction);

// Test endpoint for deep link functionality
router.get('/test-deep-link', testDeepLink);

module.exports = router;
