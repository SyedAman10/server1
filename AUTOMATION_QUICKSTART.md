# 🚀 Gmail Automation - Quick Start Guide

## ✅ What's Been Created

### Backend Infrastructure

1. **Database Schema** (4 tables):
   - `automation_agents` - Stores automation agents
   - `automation_workflows` - Stores workflow definitions
   - `automation_executions` - Logs execution history
   - `email_agent_configs` - Gmail-specific configurations

2. **Models** (4 files):
   - `models/automationAgent.model.js` - Agent CRUD operations
   - `models/automationWorkflow.model.js` - Workflow CRUD
   - `models/automationExecution.model.js` - Execution tracking
   - `models/emailAgentConfig.model.js` - Email configurations

3. **Services** (3 files):
   - `services/automation/gmailIntegrationService.js` - Gmail OAuth & API
   - `services/automation/automationExecutionEngine.js` - Workflow execution
   - `services/automation/emailPollingService.js` - Polling for new emails

4. **API Layer** (2 files):
   - `controllers/automation.controller.js` - HTTP request handlers
   - `routes/automation.routes.js` - API endpoints

5. **Documentation**:
   - `AUTOMATION_SYSTEM_GUIDE.md` - Complete system documentation
   - `AUTOMATION_QUICKSTART.md` - This file!

---

## 🔧 Setup Steps

### 1. Run Database Migration

On your server:

```bash
cd /home/ubuntu/server1
node scripts/init-database.js
```

**Expected Output:**
```
✅ Automation agents table created successfully
✅ Automation agents indexes created
✅ Automation workflows table created successfully
✅ Automation workflows indexes created
✅ Automation executions table created successfully
✅ Automation executions indexes created
✅ Email agent configs table created successfully
✅ Email agent configs indexes created
🎉 Database initialization completed successfully!
```

### 2. Restart PM2

```bash
pm2 restart index
pm2 logs index
```

**Expected in Logs:**
```
Server running on port 3000
📧 Email polling service started
```

### 3. Test API Endpoint

```bash
curl -X GET https://class.xytek.ai/api/automation/agents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "agents": [],
  "count": 0
}
```

---

## 📝 Creating Your First Email Agent

### Step 1: Create an Inbound Email Agent

```bash
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Support Email Bot",
    "description": "Auto-responds to support emails",
    "type": "email_inbound",
    "config": {
      "pollingInterval": 60
    }
  }'
```

**Copy the `agentId` from the response** (e.g., `1`)

### Step 2: Authorize Gmail

```bash
curl -X GET https://class.xytek.ai/api/automation/agents/1/gmail/auth \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Open the returned `authUrl` in your browser** and authorize Gmail access. The callback will automatically save your tokens.

### Step 3: Create a Workflow

Create a file `workflow.json`:

```json
{
  "agentId": 1,
  "name": "Auto-Reply to New Emails",
  "description": "Automatically reply to incoming support emails",
  "triggerConfig": {
    "type": "email_received",
    "filters": {
      "from": ".*",
      "subject": ".*"
    }
  },
  "actions": [
    {
      "type": "reply_to_email",
      "config": {
        "replyBody": "Thank you for your email! We've received your message and will respond within 24 hours.\n\nBest regards,\nXYTEK Support Team"
      }
    },
    {
      "type": "mark_as_read"
    }
  ],
  "status": "active"
}
```

Then send it:

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d @workflow.json
```

### Step 4: Activate the Agent

```bash
curl -X PATCH https://class.xytek.ai/api/automation/agents/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"status": "active"}'
```

### Step 5: Test It!

1. Send an email to the Gmail account you authorized
2. Wait up to 60 seconds (polling interval)
3. Check the execution logs:

```bash
curl -X GET https://class.xytek.ai/api/automation/agents/1/executions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

4. You should receive an auto-reply!

---

## 📊 Available API Endpoints

### Agents

- `POST /api/automation/agents` - Create agent
- `GET /api/automation/agents` - List agents
- `GET /api/automation/agents/:agentId` - Get agent details
- `PUT /api/automation/agents/:agentId` - Update agent
- `DELETE /api/automation/agents/:agentId` - Delete agent
- `PATCH /api/automation/agents/:agentId/status` - Toggle status

### Gmail OAuth

- `GET /api/automation/agents/:agentId/gmail/auth` - Get OAuth URL
- `GET /api/automation/gmail/callback` - OAuth callback (automatic)
- `PUT /api/automation/agents/:agentId/email-config` - Update config

### Workflows

- `POST /api/automation/workflows` - Create workflow
- `GET /api/automation/agents/:agentId/workflows` - List workflows
- `GET /api/automation/workflows/:workflowId` - Get workflow
- `PUT /api/automation/workflows/:workflowId` - Update workflow
- `DELETE /api/automation/workflows/:workflowId` - Delete workflow
- `POST /api/automation/workflows/:workflowId/execute` - Manual execution

### Executions

- `GET /api/automation/agents/:agentId/executions` - Execution history
- `GET /api/automation/agents/:agentId/stats` - Execution statistics

---

## 🎨 Frontend Integration Ideas

### Visual Workflow Builder (n8n-style)

```
┌─────────────────────────────────────────────────┐
│  📧 New Email Received                          │
│  Trigger: email_received                        │
│  Filters: from contains "@customer.com"         │
└─────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  ✉️  Reply to Email                             │
│  Reply: "Thank you for contacting us..."        │
└─────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  ✓ Mark as Read                                 │
└─────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  🔔 Send Slack Notification                     │
│  Channel: #support                              │
│  Message: "New ticket from {{email.from}}"      │
└─────────────────────────────────────────────────┘
```

### Suggested Frontend Components

1. **Agent List Page**
   - Cards showing active/inactive agents
   - Quick toggle buttons
   - Last run timestamp
   - Success/failure stats

2. **Workflow Builder**
   - Drag-and-drop trigger blocks
   - Drag-and-drop action blocks
   - Visual connection lines
   - Condition editor (if/else logic)

3. **Execution Logs Dashboard**
   - Timeline view of executions
   - Filter by status (success/failed)
   - Detailed execution data viewer
   - Error messages and stack traces

4. **Gmail OAuth Flow**
   - "Connect Gmail" button
   - OAuth popup window
   - Success/error feedback
   - Display connected email address

---

## 🔐 Required Environment Variables

Add these to your `.env` file:

```env
# Gmail OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://class.xytek.ai/api/automation/gmail/callback

# Existing variables (already set)
DATABASE_URL=your-database-url
JWT_SECRET=your-jwt-secret
```

---

## 🧪 Testing Checklist

- [ ] Database tables created successfully
- [ ] PM2 restarted and email polling started
- [ ] Can create an agent via API
- [ ] Can get OAuth URL and authorize Gmail
- [ ] Can create a workflow
- [ ] Can activate an agent
- [ ] Email polling detects new emails
- [ ] Workflow executes successfully
- [ ] Can view execution logs
- [ ] Auto-reply is received

---

## 🐛 Troubleshooting

### Email polling not working

**Check logs:**
```bash
pm2 logs index | grep "📧"
```

You should see:
```
📧 Polling email agents...
   Found X email agent(s) to poll
```

**If not polling:**
```bash
pm2 restart index
```

### OAuth tokens expired

Tokens are automatically refreshed. Check logs:
```bash
pm2 logs index | grep "Refreshing access token"
```

### Workflow not triggering

1. Check agent status: `SELECT * FROM automation_agents WHERE id = 1;`
2. Check workflow status: `SELECT * FROM automation_workflows WHERE agent_id = 1;`
3. Check email config: `SELECT * FROM email_agent_configs WHERE agent_id = 1;`
4. Check executions: `SELECT * FROM automation_executions ORDER BY started_at DESC LIMIT 10;`

---

## 🚀 Next Steps

1. **Build Frontend UI**: Create React components for visual workflow builder
2. **Add More Triggers**:
   - Scheduled triggers (cron jobs)
   - Webhook triggers
   - Manual triggers
3. **Add More Actions**:
   - Send Slack notifications
   - Create database records
   - Call external APIs
   - AI processing (OpenAI, Gemini)
4. **Advanced Features**:
   - Multi-step workflows with branching
   - Loop actions
   - Error handling and retries
   - Workflow templates

---

## 📚 Full Documentation

See `AUTOMATION_SYSTEM_GUIDE.md` for complete documentation including:
- Detailed architecture
- Database schema
- All available actions
- Template variables
- Condition operators
- Advanced examples

---

**Created by:** XYTEK Development Team  
**Last Updated:** November 19, 2025  
**Status:** ✅ Backend infrastructure complete, ready for frontend integration

