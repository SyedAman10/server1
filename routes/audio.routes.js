const express = require('express');
const { audioMessageController } = require('../controllers/audio.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all audio routes
router.use(authenticate);

// Audio message endpoint
router.post('/message', audioMessageController);

module.exports = router;
