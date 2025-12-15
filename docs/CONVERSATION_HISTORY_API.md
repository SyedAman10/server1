# Conversation History API Documentation

This API provides ChatGPT-like conversation history functionality, allowing users to view, search, and manage their AI conversation history.

## Setup

### 1. Initialize Database Tables

Run the database initialization script:

```bash
node scripts/init-conversations-tables.js
```

This will create:
- `conversations` table: Stores conversation metadata
- `conversation_messages` table: Stores individual messages
- Indexes for performance optimization

### 2. Enable pg_trgm Extension (for search)

If not already enabled, run in your PostgreSQL database:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## API Endpoints

All endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### 1. Get All Conversations

**GET** `/api/conversations`

Get all conversations for the authenticated user.

**Query Parameters:**
- `limit` (optional): Number of conversations to return (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "uuid-here",
      "user_id": 4,
      "title": "How to create assignments",
      "created_at": "2025-12-15T10:30:00Z",
      "updated_at": "2025-12-15T10:35:00Z",
      "last_message_at": "2025-12-15T10:35:00Z",
      "message_count": 8,
      "first_user_message": "How do I create an assignment?"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

### 2. Get Specific Conversation with Messages

**GET** `/api/conversations/:conversationId`

Get a specific conversation with all its messages.

**Response:**
```json
{
  "success": true,
  "conversation": {
    "id": "uuid-here",
    "user_id": 4,
    "title": "How to create assignments",
    "created_at": "2025-12-15T10:30:00Z",
    "updated_at": "2025-12-15T10:35:00Z",
    "last_message_at": "2025-12-15T10:35:00Z",
    "messages": [
      {
        "id": 1,
        "conversation_id": "uuid-here",
        "role": "user",
        "content": "How do I create an assignment?",
        "metadata": null,
        "created_at": "2025-12-15T10:30:00Z"
      },
      {
        "id": 2,
        "conversation_id": "uuid-here",
        "role": "assistant",
        "content": "I can help you create an assignment...",
        "metadata": null,
        "created_at": "2025-12-15T10:30:15Z"
      }
    ]
  }
}
```

### 3. Update Conversation Title

**PATCH** `/api/conversations/:conversationId/title`

Update the title of a conversation.

**Request Body:**
```json
{
  "title": "New conversation title"
}
```

**Response:**
```json
{
  "success": true,
  "conversation": {
    "id": "uuid-here",
    "user_id": 4,
    "title": "New conversation title",
    "created_at": "2025-12-15T10:30:00Z",
    "updated_at": "2025-12-15T11:00:00Z",
    "last_message_at": "2025-12-15T10:35:00Z"
  },
  "message": "Conversation title updated successfully"
}
```

### 4. Delete Conversation

**DELETE** `/api/conversations/:conversationId`

Delete a conversation and all its messages.

**Response:**
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

### 5. Search Conversations

**GET** `/api/conversations/search?q=search-term`

Search conversations by title or message content.

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Number of results (default: 20)

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "uuid-here",
      "user_id": 4,
      "title": "How to create assignments",
      "created_at": "2025-12-15T10:30:00Z",
      "updated_at": "2025-12-15T10:35:00Z",
      "last_message_at": "2025-12-15T10:35:00Z",
      "message_count": 8
    }
  ],
  "count": 1,
  "query": "assignment"
}
```

### 6. Get Conversation Statistics

**GET** `/api/conversations/stats`

Get statistics about user's conversations.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_conversations": 15,
    "total_messages": 234,
    "last_conversation_date": "2025-12-15T10:35:00Z"
  }
}
```

## Frontend Integration

### Example: Fetch All Conversations

```javascript
const fetchConversations = async () => {
  const response = await fetch('https://class.xytek.ai/api/conversations', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return data.conversations;
};
```

### Example: Load Conversation Messages

```javascript
const loadConversation = async (conversationId) => {
  const response = await fetch(`https://class.xytek.ai/api/conversations/${conversationId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return data.conversation;
};
```

### Example: Rename Conversation

```javascript
const renameConversation = async (conversationId, newTitle) => {
  const response = await fetch(`https://class.xytek.ai/api/conversations/${conversationId}/title`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: newTitle })
  });
  const data = await response.json();
  return data.conversation;
};
```

### Example: Delete Conversation

```javascript
const deleteConversation = async (conversationId) => {
  const response = await fetch(`https://class.xytek.ai/api/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return data;
};
```

### Example: Search Conversations

```javascript
const searchConversations = async (query) => {
  const response = await fetch(`https://class.xytek.ai/api/conversations/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return data.conversations;
};
```

## Features

### Auto-Generated Titles
- The first user message in a conversation is automatically used to generate a title
- Titles are limited to 50-60 characters for better display
- You can manually rename conversations anytime

### Message Persistence
- All messages are automatically saved to the database
- Messages are linked to conversations for easy retrieval
- Supports metadata for rich message types

### Full-Text Search
- Uses PostgreSQL's trigram similarity for fuzzy search
- Searches both conversation titles and message content
- Fast and efficient with proper indexing

### Pagination
- List conversations with limit/offset pagination
- Ordered by most recent activity

### Security
- All endpoints require authentication
- Users can only access their own conversations
- Proper validation on all inputs

## Database Schema

### `conversations` Table
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### `conversation_messages` Table
```sql
CREATE TABLE conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Notes

- Conversations are created automatically when a user starts a new AI chat
- The conversation ID from the AI chat is used as the database primary key
- In-memory cache is maintained for active conversations
- Database persistence happens asynchronously to avoid blocking chat responses
- Old conversations (24+ hours inactive) are cleaned from memory but remain in database

