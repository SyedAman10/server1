const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversation.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Create a new conversation
router.post('/', conversationController.createConversation);

// Get all conversations for authenticated user
router.get('/', conversationController.getConversations);

// Get conversation statistics
router.get('/stats', conversationController.getConversationStats);

// Search conversations
router.get('/search', conversationController.searchConversations);

// Get a specific conversation with messages
router.get('/:conversationId', conversationController.getConversationById);

// Update conversation title
router.patch('/:conversationId/title', conversationController.updateConversationTitle);

// Delete a conversation
router.delete('/:conversationId', conversationController.deleteConversation);

module.exports = router;

