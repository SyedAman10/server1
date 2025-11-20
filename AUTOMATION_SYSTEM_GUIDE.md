# 🤖 Automation System Guide - XYTEK Classroom Assistant

## Overview

The automation system allows users to create custom automation workflows similar to n8n, Zapier, or IFTTT. This guide focuses on the **Gmail automation** feature, which enables users to create **inbound** and **outbound** email agents.

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [Setting Up Gmail Automation](#setting-up-gmail-automation)
4. [Creating Agents](#creating-agents)
5. [Creating Workflows](#creating-workflows)
6. [Triggers and Actions](#triggers-and-actions)
7. [API Endpoints](#api-endpoints)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/Next.js)                 │
│            n8n-style visual workflow builder UI              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Express)                     │
│                  /api/automation/*                           │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌──────────────────────┐                 ┌──────────────────────┐
│  Automation Engine   │                 │   Gmail Service      │
│  - Execute workflows │                 │   - OAuth            │
│  - Evaluate conditions│                 │   - Send/Read emails │
│  - Run actions       │                 │   - Filters          │
└──────────────────────┘                 └──────────────────────┘
        │                                           │
        ▼                                           ▼
┌──────────────────────┐                 ┌──────────────────────┐
│  Email Polling       │                 │   Database           │
│  - Check new emails  │                 │   - Agents           │
│  - Trigger workflows │                 │   - Workflows        │
│                      │                 │   - Executions       │
└──────────────────────┘                 └──────────────────────┘
```

### Key Files

- **Database**
  - `scripts/init-database.js` - Database schema migration
  - `models/automationAgent.model.js` - Agent CRUD operations
  - `models/automationWorkflow.model.js` - Workflow CRUD operations
  - `models/automationExecution.model.js` - Execution tracking
  - `models/emailAgentConfig.model.js` - Email-specific configurations

- **Services**
  - `services/automation/gmailIntegrationService.js` - Gmail API integration
  - `services/automation/automationExecutionEngine.js` - Workflow execution engine
  - `services/automation/emailPollingService.js` - Email polling system

- **API**
  - `controllers/automation.controller.js` - HTTP request handlers
  - `routes/automation.routes.js` - API route definitions

---

## Database Schema

### Tables

#### 1. `automation_agents`
Stores automation agents (email bots, webhooks, scheduled tasks).

```sql
CREATE TABLE automation_agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'email_inbound', 'email_outbound', 'webhook', 'scheduled'
  status VARCHAR(50) DEFAULT 'inactive', -- 'active', 'inactive', 'paused', 'error'
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP
);
```

#### 2. `automation_workflows`
Stores workflow definitions (trigger + actions + conditions).

```sql
CREATE TABLE automation_workflows (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES automation_agents(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_config JSONB NOT NULL,
  actions JSONB NOT NULL,
  conditions JSONB,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'draft'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. `automation_executions`
Stores execution logs for debugging and analytics.

```sql
CREATE TABLE automation_executions (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES automation_agents(id) ON DELETE CASCADE,
  workflow_id INTEGER REFERENCES automation_workflows(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'running', 'cancelled'
  trigger_data JSONB,
  execution_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER
);
```

#### 4. `email_agent_configs`
Stores email-specific configurations (OAuth tokens, IMAP/SMTP settings).

```sql
CREATE TABLE email_agent_configs (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER UNIQUE REFERENCES automation_agents(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL,
  provider VARCHAR(50) DEFAULT 'gmail', -- 'gmail', 'outlook', 'custom'
  oauth_tokens JSONB,
  imap_config JSONB,
  smtp_config JSONB,
  filters JSONB,
  polling_interval INTEGER DEFAULT 300, -- seconds
  last_email_id VARCHAR(255),
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Setting Up Gmail Automation

### Prerequisites

1. **Google Cloud Project** with Gmail API enabled
2. **OAuth 2.0 Credentials** configured
3. **Environment Variables** in `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://class.xytek.ai/api/automation/gmail/callback
```

### Steps to Run Migration

```bash
cd /home/ubuntu/server1
node scripts/init-database.js
```

Expected output:
```
✅ Automation agents table created successfully
✅ Automation workflows table created successfully
✅ Automation executions table created successfully
✅ Email agent configs table created successfully
```

---

## Creating Agents

### Agent Types

1. **`email_inbound`** - Triggers on incoming emails
2. **`email_outbound`** - Sends emails on demand (via AI or other triggers)
3. **`webhook`** - Triggers on HTTP webhook calls
4. **`scheduled`** - Triggers on a schedule (cron-like)

### Example: Create an Inbound Email Agent

**API Request:**
```bash
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Support Email Bot",
    "description": "Auto-responds to support emails",
    "type": "email_inbound",
    "config": {
      "emailAddress": "support@yourcompany.com",
      "pollingInterval": 60
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": 1,
    "user_id": 123,
    "name": "Support Email Bot",
    "description": "Auto-responds to support emails",
    "type": "email_inbound",
    "status": "inactive",
    "config": {
      "emailAddress": "support@yourcompany.com",
      "pollingInterval": 60
    },
    "created_at": "2025-11-19T10:00:00Z",
    "updated_at": "2025-11-19T10:00:00Z"
  }
}
```

---

## Gmail OAuth Setup

### Step 1: Get OAuth Authorization URL

```bash
curl -X GET https://class.xytek.ai/api/automation/agents/1/gmail/auth \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### Step 2: User Authorizes Gmail Access

Redirect the user to `authUrl`. After authorization, Google will redirect to:

```
https://class.xytek.ai/api/automation/gmail/callback?code=AUTHORIZATION_CODE&state=...
```

### Step 3: Backend Exchanges Code for Tokens

The callback handler automatically:
1. Exchanges the authorization code for access/refresh tokens
2. Stores tokens in `email_agent_configs` table
3. Returns success response

---

## Creating Workflows

### Workflow Structure

```json
{
  "agentId": 1,
  "name": "Auto-Reply to Support Emails",
  "description": "Automatically reply to emails from customers",
  "triggerConfig": {
    "type": "email_received",
    "filters": {
      "from": ".*@customer\\.com",
      "subject": "support|help|issue",
      "hasAttachment": false
    }
  },
  "actions": [
    {
      "type": "reply_to_email",
      "config": {
        "replyBody": "Thank you for contacting support. We'll get back to you within 24 hours."
      }
    },
    {
      "type": "mark_as_read"
    }
  ],
  "conditions": {
    "operator": "AND",
    "rules": [
      {
        "field": "email.from",
        "operator": "contains",
        "value": "@customer.com"
      }
    ]
  },
  "status": "active"
}
```

### Example: Create a Workflow

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d @workflow.json
```

---

## Triggers and Actions

### Supported Triggers

#### 1. `email_received` (Inbound Email Agent)

Triggers when a new email is received that matches filters.

**Filters:**
- `from`: Regex pattern for sender email
- `to`: Regex pattern for recipient email
- `subject`: Regex pattern for subject
- `bodyContains`: Regex pattern for email body
- `hasAttachment`: Boolean
- `labels`: Array of Gmail label IDs

**Trigger Data:**
```json
{
  "email": {
    "id": "18c5d1234567890",
    "from": "john@example.com",
    "to": "support@yourcompany.com",
    "subject": "Need help with login",
    "body": "I can't log into my account...",
    "date": "2025-11-19T10:00:00Z",
    "attachments": []
  },
  "agent": {
    "id": 1,
    "name": "Support Email Bot",
    "type": "email_inbound"
  }
}
```

---

### Supported Actions

#### 1. `send_email`

Send a new email.

```json
{
  "type": "send_email",
  "config": {
    "to": "{{email.from}}",
    "subject": "Re: {{email.subject}}",
    "body": "Thank you for your email!",
    "isHtml": false
  }
}
```

#### 2. `reply_to_email`

Reply to the incoming email.

```json
{
  "type": "reply_to_email",
  "config": {
    "replyBody": "We've received your request and will respond within 24 hours."
  }
}
```

#### 3. `forward_email`

Forward the email to another address.

```json
{
  "type": "forward_email",
  "config": {
    "forwardTo": "manager@yourcompany.com"
  }
}
```

#### 4. `mark_as_read`

Mark the email as read.

```json
{
  "type": "mark_as_read",
  "config": {}
}
```

#### 5. `add_label`

Add a Gmail label to the email.

```json
{
  "type": "add_label",
  "config": {
    "labelId": "Label_1234567890"
  }
}
```

#### 6. `save_to_database`

Save email data to a database table.

```json
{
  "type": "save_to_database",
  "config": {
    "tableName": "support_tickets",
    "columnMapping": {
      "email": "{{email.from}}",
      "subject": "{{email.subject}}",
      "message": "{{email.body}}",
      "received_at": "{{email.date}}"
    }
  }
}
```

#### 7. `http_request`

Make an HTTP request (webhook).

```json
{
  "type": "http_request",
  "config": {
    "url": "https://api.yourcompany.com/support-tickets",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer API_KEY"
    },
    "body": {
      "from": "{{email.from}}",
      "subject": "{{email.subject}}",
      "message": "{{email.body}}"
    }
  }
}
```

---

### Template Variables

Use `{{variable.path}}` syntax to access trigger data in action configurations:

- `{{email.from}}` - Sender email
- `{{email.to}}` - Recipient email
- `{{email.subject}}` - Email subject
- `{{email.body}}` - Email body
- `{{email.date}}` - Email date
- `{{agent.id}}` - Agent ID
- `{{agent.name}}` - Agent name

---

## API Endpoints

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/automation/agents` | Create a new agent |
| GET | `/api/automation/agents` | Get all user's agents |
| GET | `/api/automation/agents/:agentId` | Get agent by ID |
| PUT | `/api/automation/agents/:agentId` | Update agent |
| DELETE | `/api/automation/agents/:agentId` | Delete agent |
| PATCH | `/api/automation/agents/:agentId/status` | Toggle agent status |

### Gmail OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/agents/:agentId/gmail/auth` | Get OAuth URL |
| GET | `/api/automation/gmail/callback` | OAuth callback handler |
| PUT | `/api/automation/agents/:agentId/email-config` | Update email config |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/automation/workflows` | Create a workflow |
| GET | `/api/automation/agents/:agentId/workflows` | Get workflows by agent |
| GET | `/api/automation/workflows/:workflowId` | Get workflow by ID |
| PUT | `/api/automation/workflows/:workflowId` | Update workflow |
| DELETE | `/api/automation/workflows/:workflowId` | Delete workflow |
| POST | `/api/automation/workflows/:workflowId/execute` | Execute workflow manually |

### Executions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/agents/:agentId/executions` | Get execution history |
| GET | `/api/automation/agents/:agentId/stats` | Get execution statistics |

---

## Testing

### 1. Create Test Agent

```bash
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Email Bot",
    "description": "For testing purposes",
    "type": "email_inbound",
    "config": {}
  }'
```

### 2. Authorize Gmail

```bash
# Get auth URL
curl -X GET https://class.xytek.ai/api/automation/agents/1/gmail/auth \
  -H "Authorization: Bearer YOUR_TOKEN"

# Open the returned authUrl in browser and authorize
```

### 3. Create Test Workflow

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 1,
    "name": "Auto-Reply Test",
    "description": "Test auto-reply workflow",
    "triggerConfig": {
      "type": "email_received",
      "filters": {
        "from": ".*test.*"
      }
    },
    "actions": [
      {
        "type": "reply_to_email",
        "config": {
          "replyBody": "This is an automated test reply."
        }
      }
    ],
    "status": "active"
  }'
```

### 4. Activate Agent

```bash
curl -X PATCH https://class.xytek.ai/api/automation/agents/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "active"}'
```

### 5. Send Test Email

Send an email to the Gmail account you authorized with "test" in the sender address. The agent should:
1. Detect the new email within 60 seconds (polling interval)
2. Execute the workflow
3. Send an auto-reply

### 6. Check Execution Logs

```bash
curl -X GET https://class.xytek.ai/api/automation/agents/1/executions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Troubleshooting

### Issue: Email polling not working

**Solution:**
Check server logs for email polling activity:
```bash
pm2 logs index | grep "📧"
```

Restart the server to restart polling:
```bash
pm2 restart index
```

### Issue: OAuth tokens expired

**Solution:**
The system automatically refreshes tokens. Check for token refresh errors in logs:
```bash
pm2 logs index | grep "Refreshing access token"
```

### Issue: Workflow not triggering

**Checks:**
1. Agent status is `active`
2. Workflow status is `active`
3. Email matches trigger filters
4. Email config `last_checked_at` is updating

Query the database:
```sql
SELECT * FROM automation_agents WHERE id = 1;
SELECT * FROM email_agent_configs WHERE agent_id = 1;
SELECT * FROM automation_executions ORDER BY started_at DESC LIMIT 10;
```

---

## Next Steps

1. **Frontend Development**: Build n8n-style visual workflow builder
2. **Additional Triggers**: Add scheduled triggers, webhook triggers
3. **More Actions**: Add Slack integration, database operations, AI processing
4. **Advanced Features**: 
   - Multi-step workflows
   - Branching logic (if/else)
   - Loop actions
   - Error handling and retries

---

## 📚 References

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [n8n Workflow Automation](https://n8n.io/)

---

**Created by:** XYTEK Development Team  
**Last Updated:** November 19, 2025

