const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { 
  handleMessage, 
  getConversationHistory, 
  clearConversationHistory,
  saveContext,
  getContext
} = require('../controllers/ai-agent.controller');

const router = express.Router();

// Protect all AI agent routes
router.use(authenticate);

// AI agent endpoints
router.post('/message', handleMessage);
router.get('/conversations/:conversationId', getConversationHistory);
router.delete('/conversations/:conversationId', clearConversationHistory);

// Context management
router.post('/context', saveContext);
router.get('/context/:conversationId', getContext);

module.exports = router;