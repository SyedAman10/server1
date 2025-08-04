const express = require('express');
const router = express.Router();
const { searchFiles } = require('../controllers/drive.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/search', authenticateToken, searchFiles);

module.exports = router; 