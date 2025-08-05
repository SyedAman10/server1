const express = require('express');
const { getAuthUrl, handleWebAuth, handleMobileAuth, handleMobileCallback } = require('../controllers/auth.controller');

const router = express.Router();

// Web flow endpoints
router.get('/google', getAuthUrl);
router.get('/google/callback', handleWebAuth);

// Mobile flow endpoints
router.post('/google/mobile', handleMobileAuth);
router.get('/google/mobile-callback', handleMobileCallback);

module.exports = router;
