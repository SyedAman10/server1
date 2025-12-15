const conversationModel = require('../models/conversation.model');

/**
 * Conversation Controller
 * Handles HTTP requests for conversation history operations
 */

// Create a new conversation
exports.createConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title } = req.body;

    // Generate a new conversation ID
    const { v4: uuidv4 } = require('uuid');
    const conversationId = uuidv4();

    const conversation = await conversationModel.createConversation({
      conversationId,
      userId,
      title: title || 'New Conversation'
    });

    return res.status(201).json({
      success: true,
      conversation,
      message: 'Conversation created successfully'
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create conversation'
    });
  }
};

// Get all conversations for the authenticated user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const conversations = await conversationModel.getConversationsByUser(userId, limit, offset);

    return res.status(200).json({
      success: true,
      conversations,
      count: conversations.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get conversations'
    });
  }
};

// Get a specific conversation with all its messages
exports.getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    const conversation = await conversationModel.getConversationById(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const messages = await conversationModel.getMessagesByConversation(conversationId, userId);

    return res.status(200).json({
      success: true,
      conversation: {
        ...conversation,
        messages
      }
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get conversation'
    });
  }
};

// Update conversation title
exports.updateConversationTitle = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const conversation = await conversationModel.updateConversationTitle(
      conversationId,
      userId,
      title.trim()
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
      message: 'Conversation title updated successfully'
    });
  } catch (error) {
    console.error('Error updating conversation title:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update conversation title'
    });
  }
};

// Delete a conversation
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    const conversation = await conversationModel.deleteConversation(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete conversation'
    });
  }
};

// Search conversations
exports.searchConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    const conversations = await conversationModel.searchConversations(userId, q.trim(), limit);

    return res.status(200).json({
      success: true,
      conversations,
      count: conversations.length,
      query: q
    });
  } catch (error) {
    console.error('Error searching conversations:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search conversations'
    });
  }
};

// Get conversation statistics
exports.getConversationStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await conversationModel.getConversationStats(userId);

    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting conversation stats:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get conversation statistics'
    });
  }
};

