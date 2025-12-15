const db = require('../utils/db');

/**
 * Conversation Model
 * Handles database operations for AI conversations
 */

// Create a new conversation
async function createConversation({ conversationId, userId, title }) {
  const query = `
    INSERT INTO conversations (id, user_id, title, created_at, updated_at, last_message_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const values = [conversationId, userId, title || 'New Conversation'];
  const result = await db.query(query, values);
  return result.rows[0];
}

// Get all conversations for a user
async function getConversationsByUser(userId, limit = 50, offset = 0) {
  const query = `
    SELECT 
      c.*,
      (
        SELECT COUNT(*)::int
        FROM conversation_messages cm
        WHERE cm.conversation_id = c.id
      ) as message_count,
      (
        SELECT content
        FROM conversation_messages cm
        WHERE cm.conversation_id = c.id
        AND cm.role = 'user'
        ORDER BY cm.created_at ASC
        LIMIT 1
      ) as first_user_message
    FROM conversations c
    WHERE c.user_id = $1
    ORDER BY c.last_message_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await db.query(query, [userId, limit, offset]);
  return result.rows;
}

// Get a specific conversation
async function getConversationById(conversationId, userId) {
  const query = `
    SELECT c.*
    FROM conversations c
    WHERE c.id = $1 AND c.user_id = $2;
  `;
  const result = await db.query(query, [conversationId, userId]);
  return result.rows[0];
}

// Update conversation title
async function updateConversationTitle(conversationId, userId, title) {
  const query = `
    UPDATE conversations
    SET title = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND user_id = $3
    RETURNING *;
  `;
  const result = await db.query(query, [title, conversationId, userId]);
  return result.rows[0];
}

// Update last message timestamp
async function updateLastMessageTime(conversationId) {
  const query = `
    UPDATE conversations
    SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;
  const result = await db.query(query, [conversationId]);
  return result.rows[0];
}

// Delete a conversation
async function deleteConversation(conversationId, userId) {
  const query = `
    DELETE FROM conversations
    WHERE id = $1 AND user_id = $2
    RETURNING *;
  `;
  const result = await db.query(query, [conversationId, userId]);
  return result.rows[0];
}

// Add a message to a conversation
async function addMessage({ conversationId, role, content, metadata }) {
  const query = `
    INSERT INTO conversation_messages (conversation_id, role, content, metadata, created_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const values = [conversationId, role, content, metadataJson];
  const result = await db.query(query, values);
  
  // Update conversation's last_message_at timestamp
  await updateLastMessageTime(conversationId);
  
  return result.rows[0];
}

// Get all messages for a conversation
async function getMessagesByConversation(conversationId, userId) {
  // First verify user owns this conversation
  const conversation = await getConversationById(conversationId, userId);
  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }
  
  const query = `
    SELECT *
    FROM conversation_messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await db.query(query, [conversationId]);
  return result.rows;
}

// Search conversations by title or content
async function searchConversations(userId, searchTerm, limit = 20) {
  const query = `
    SELECT DISTINCT c.*,
      (
        SELECT COUNT(*)::int
        FROM conversation_messages cm
        WHERE cm.conversation_id = c.id
      ) as message_count
    FROM conversations c
    LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
    WHERE c.user_id = $1
    AND (
      c.title ILIKE $2
      OR cm.content ILIKE $2
    )
    ORDER BY c.last_message_at DESC
    LIMIT $3;
  `;
  const searchPattern = `%${searchTerm}%`;
  const result = await db.query(query, [userId, searchPattern, limit]);
  return result.rows;
}

// Get conversation statistics for a user
async function getConversationStats(userId) {
  const query = `
    SELECT 
      COUNT(DISTINCT c.id)::int as total_conversations,
      COUNT(cm.id)::int as total_messages,
      MAX(c.last_message_at) as last_conversation_date
    FROM conversations c
    LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
    WHERE c.user_id = $1;
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0];
}

// Auto-generate conversation title from first messages
async function generateConversationTitle(conversationId) {
  const query = `
    SELECT content
    FROM conversation_messages
    WHERE conversation_id = $1
    AND role = 'user'
    ORDER BY created_at ASC
    LIMIT 1;
  `;
  const result = await db.query(query, [conversationId]);
  
  if (result.rows.length > 0) {
    const firstMessage = result.rows[0].content;
    // Take first 50 characters or first sentence
    let title = firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...'
      : firstMessage;
    
    // If there's a sentence ending, use that
    const sentenceEnd = firstMessage.match(/^.+?[.!?]/);
    if (sentenceEnd && sentenceEnd[0].length <= 60) {
      title = sentenceEnd[0];
    }
    
    return title;
  }
  
  return 'New Conversation';
}

module.exports = {
  createConversation,
  getConversationsByUser,
  getConversationById,
  updateConversationTitle,
  updateLastMessageTime,
  deleteConversation,
  addMessage,
  getMessagesByConversation,
  searchConversations,
  getConversationStats,
  generateConversationTitle
};

