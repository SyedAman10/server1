const { v4: uuidv4 } = require('uuid');

// In-memory storage for conversations
const conversations = new Map();

/**
 * Generate a unique conversation ID
 */
function generateConversationId() {
  return uuidv4();
}

/**
 * Get or create a conversation
 */
function getConversation(conversationId) {
  if (!conversationId) {
    conversationId = generateConversationId();
  }
  
  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, {
      id: conversationId,
      messages: [],
      context: {
        lastCourse: null,
        lastAction: null,
        lastParameters: null
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  return conversations.get(conversationId);
}

/**
 * Add a message to a conversation
 */
function addMessage(conversationId, message, role = 'user') {
  const conversation = getConversation(conversationId);
  
  // If the message is an object (like an API response), store it as is
  const messageContent = typeof message === 'object' ? message : {
    text: message
  };
  
  conversation.messages.push({
    role,
    content: messageContent,
    timestamp: new Date()
  });
  
  conversation.updatedAt = new Date();
  
  return conversation;
}

/**
 * Update conversation context
 */
function updateContext(conversationId, context) {
  const conversation = getConversation(conversationId);
  
  conversation.context = {
    ...conversation.context,
    ...context,
    lastUpdated: new Date()
  };
  
  conversation.updatedAt = new Date();
  
  return conversation;
}

/**
 * Get conversation history in a format suitable for the AI model
 */
function getFormattedHistory(conversationId) {
  const conversation = getConversation(conversationId);
  
  return conversation.messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content
  }));
}

/**
 * Get the last message from a conversation
 */
function getLastMessage(conversationId) {
  const conversation = getConversation(conversationId);
  return conversation.messages[conversation.messages.length - 1];
}

/**
 * Get the last N messages from a conversation
 */
function getLastMessages(conversationId, count = 5) {
  const conversation = getConversation(conversationId);
  return conversation.messages.slice(-count);
}

/**
 * Clear a conversation
 */
function clearConversation(conversationId) {
  if (conversations.has(conversationId)) {
    conversations.delete(conversationId);
  }
}

/**
 * Get all conversations
 */
function getAllConversations() {
  return Array.from(conversations.values());
}

/**
 * Clean up old conversations (older than 24 hours)
 */
function cleanupOldConversations() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  for (const [id, conversation] of conversations.entries()) {
    if (conversation.updatedAt < oneDayAgo) {
      conversations.delete(id);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupOldConversations, 60 * 60 * 1000);

module.exports = {
  generateConversationId,
  getConversation,
  addMessage,
  updateContext,
  getFormattedHistory,
  getLastMessage,
  getLastMessages,
  clearConversation,
  getAllConversations
}; 