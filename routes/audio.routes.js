const express = require('express');
const { audioMessageController, validateOpenAIConfig } = require('../controllers/audio.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Audio health check endpoint (no authentication required)
router.get('/health', async (req, res) => {
  try {
    const isValid = await validateOpenAIConfig();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        valid: isValid,
        keyPrefix: process.env.OPENAI_API_KEY ? 
          process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 
          'NOT SET',
        keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Protect all other audio routes
router.use(authenticate);

// Audio message endpoint
router.post('/message', audioMessageController);

module.exports = router;
