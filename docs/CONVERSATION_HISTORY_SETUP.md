# Conversation History Feature - Setup Guide

## 🎯 Quick Start

Follow these steps to enable ChatGPT-like conversation history:

### 1. Initialize Database

```bash
node scripts/init-conversations-tables.js
```

This creates the necessary tables and indexes.

### 2. Enable Full-Text Search Extension

Connect to your PostgreSQL database and run:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 3. Restart Your Server

```bash
npm start
```

### 4. Test the API

Use these endpoints (all require authentication):

```bash
# Get all conversations
GET /api/conversations

# Get specific conversation with messages
GET /api/conversations/:conversationId

# Rename conversation
PATCH /api/conversations/:conversationId/title
{
  "title": "New title"
}

# Delete conversation
DELETE /api/conversations/:conversationId

# Search conversations
GET /api/conversations/search?q=your-search-term

# Get statistics
GET /api/conversations/stats
```

## 📁 Files Created/Modified

### New Files:
1. `models/conversation.model.js` - Database operations
2. `controllers/conversation.controller.js` - HTTP handlers
3. `routes/conversation.routes.js` - API routes
4. `scripts/init-conversations-tables.js` - Database setup
5. `docs/CONVERSATION_HISTORY_API.md` - Full API documentation
6. `docs/CONVERSATION_HISTORY_SETUP.md` - This file

### Modified Files:
1. `services/ai/conversationManager.js` - Added database persistence
2. `controllers/ai-agent.controller.js` - Pass userId to conversation
3. `index.js` - Register conversation routes

## ✨ Features

- ✅ Auto-save all AI conversations to database
- ✅ Auto-generate conversation titles from first message
- ✅ Full-text search across titles and messages
- ✅ Pagination support
- ✅ Rename conversations
- ✅ Delete conversations
- ✅ View conversation statistics
- ✅ Secure (users only see their own conversations)
- ✅ Fast (indexed for performance)

## 🔒 Security

- All endpoints require authentication
- Users can only access their own conversations
- Proper input validation
- SQL injection protection
- CASCADE deletes (removing user removes their conversations)

## 📊 Database Tables

### `conversations`
Stores conversation metadata:
- id (UUID)
- user_id (FK to users table)
- title
- timestamps

### `conversation_messages`
Stores individual messages:
- id (auto-increment)
- conversation_id (FK to conversations)
- role (user/assistant/system)
- content
- metadata (JSONB)
- created_at

## 🎨 Frontend Integration Ideas

### Conversation List (Sidebar)
```javascript
// Fetch conversations on component mount
const conversations = await fetchConversations();

// Display in sidebar
conversations.map(conv => (
  <ConversationItem
    key={conv.id}
    title={conv.title}
    lastMessage={conv.last_message_at}
    messageCount={conv.message_count}
    onClick={() => loadConversation(conv.id)}
  />
))
```

### Search Bar
```javascript
const handleSearch = async (query) => {
  const results = await searchConversations(query);
  setFilteredConversations(results);
};
```

### Rename Conversation
```javascript
const handleRename = async (convId, newTitle) => {
  await renameConversation(convId, newTitle);
  // Refresh list
};
```

### Delete Confirmation
```javascript
const handleDelete = async (convId) => {
  if (confirm('Delete this conversation?')) {
    await deleteConversation(convId);
    // Refresh list
  }
};
```

## 🚀 Next Steps

1. **Initialize the database** (required)
2. **Restart the server** (required)
3. **Test the endpoints** with Postman or your frontend
4. **Integrate into your frontend** following the documentation

## 📖 Full Documentation

See `docs/CONVERSATION_HISTORY_API.md` for complete API documentation with examples.

## ❓ Troubleshooting

### "pg_trgm extension not found"
Run this in PostgreSQL:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### "conversations table does not exist"
Run the initialization script:
```bash
node scripts/init-conversations-tables.js
```

### "Cannot save conversation - user_id is null"
Make sure the AI agent controller passes `req.user.id` when creating conversations.

### Messages not saving
Check the console logs for database errors. The system will continue working with in-memory storage even if database saves fail.

