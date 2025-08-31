const express = require('express');
const { getAuthUrl, handleWebAuth, handleMobileAuth, handleMobileCallback, logDeepLinkInteraction, testDeepLink } = require('../controllers/auth.controller');

const router = express.Router();

// Web flow endpoints
router.get('/google', getAuthUrl);
router.get('/google/callback', handleWebAuth);

// Mobile flow endpoints
router.post('/google/mobile', handleMobileAuth);
router.get('/google/mobile-callback', handleMobileCallback);

// Deep link logging endpoint
router.post('/log-deep-link', logDeepLinkInteraction);

// Test endpoint for deep link functionality
router.get('/test-deep-link', testDeepLink);

module.exports = router;
