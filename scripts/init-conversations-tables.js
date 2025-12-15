require('dotenv').config(); // Load environment variables
const db = require('../utils/db');

/**
 * Initialize conversations and conversation_messages tables
 */

async function initConversationsTables() {
  try {
    console.log('🔄 Creating conversations tables...');

    // Create conversations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL DEFAULT 'New Conversation',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Conversations table created');

    // Create conversation_messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Conversation messages table created');

    // Create indexes for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id 
      ON conversations(user_id);
    `);
    console.log('✅ Index on conversations.user_id created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at 
      ON conversations(last_message_at DESC);
    `);
    console.log('✅ Index on conversations.last_message_at created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id 
      ON conversation_messages(conversation_id);
    `);
    console.log('✅ Index on conversation_messages.conversation_id created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at 
      ON conversation_messages(created_at);
    `);
    console.log('✅ Index on conversation_messages.created_at created');

    // Try to enable pg_trgm extension and create full-text search indexes
    console.log('📝 Attempting to enable pg_trgm extension for full-text search...');
    try {
      // Try to enable the extension
      await db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
      console.log('✅ pg_trgm extension enabled');
      
      // Create full-text search indexes
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_title_trgm 
        ON conversations USING gin(title gin_trgm_ops);
      `);
      console.log('✅ Full-text search index on conversations.title created');

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_conversation_messages_content_trgm 
        ON conversation_messages USING gin(content gin_trgm_ops);
      `);
      console.log('✅ Full-text search index on conversation_messages.content created');
    } catch (extError) {
      console.log('⚠️  Warning: Could not enable pg_trgm extension');
      console.log('   Full-text search indexes were NOT created');
      console.log('   Search will still work but may be slower on large datasets');
      console.log('');
      console.log('   To enable manually:');
      console.log('   1. Go to Neon dashboard > SQL Editor');
      console.log('   2. Run: CREATE EXTENSION pg_trgm;');
      console.log('   3. Run this script again');
      console.log('');
      console.log('   Or contact Neon support if you don\'t have permission');
    }

    console.log('');
    console.log('✅ All conversation tables and basic indexes created successfully!');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Restart your server: pm2 restart server1');
    console.log('   2. Test the API: GET /api/conversations');
    console.log('   3. Conversations will now be saved automatically!');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating conversation tables:', error);
    process.exit(1);
  }
}

// Run the initialization
initConversationsTables();

