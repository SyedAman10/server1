# Setup Instructions for Conversation History Feature

## ✅ Run on Your Server (Ubuntu)

SSH into your server and run:

```bash
cd /home/ubuntu/server1
node scripts/init-conversations-tables.js
```

This should now work because the script will load your `DATABASE_URL` from `.env`

## 📝 If You See Success:

You should see:
```
🔄 Creating conversations tables...
✅ Conversations table created
✅ Conversation messages table created
✅ Index on conversations.user_id created
✅ Index on conversations.last_message_at created
✅ Index on conversation_messages.conversation_id created
✅ Index on conversation_messages.created_at created
✅ Full-text search index on conversations.title created
✅ Full-text search index on conversation_messages.content created
✅ All conversation tables and indexes created successfully!
```

## 🔧 If You See "pg_trgm" Extension Error:

Run this SQL command in your Neon database console:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Then run the script again.

## 🚀 After Setup:

1. **Restart your server** (if it's running with pm2):
   ```bash
   pm2 restart server1
   ```

2. **Test the API endpoints**:
   ```bash
   # Get conversations (requires auth token)
   curl -H "Authorization: Bearer YOUR_TOKEN" https://class.xytek.ai/api/conversations
   ```

3. **Start using it!** 
   - All AI conversations will now be saved automatically
   - Users can view their conversation history
   - Search, rename, and delete conversations

## 📖 API Endpoints:

```
GET    /api/conversations              - List all user's conversations
GET    /api/conversations/:id          - Get conversation with messages
PATCH  /api/conversations/:id/title    - Rename conversation
DELETE /api/conversations/:id          - Delete conversation
GET    /api/conversations/search?q=    - Search conversations
GET    /api/conversations/stats        - Get statistics
```

See `docs/CONVERSATION_HISTORY_API.md` for full documentation.

