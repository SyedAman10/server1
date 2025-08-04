const express = require('express');
const { getAuthUrl, handleWebAuth, handleMobileAuth } = require('../controllers/auth.controller');

const router = express.Router();

// Web flow endpoints
router.get('/google', getAuthUrl);
router.get('/google/callback', handleWebAuth);

// Mobile flow endpoint
router.post('/google/mobile', handleMobileAuth);

module.exports = router;
