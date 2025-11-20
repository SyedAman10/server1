# 🔍 Troubleshooting: Why Agent Is Not Responding

## Quick Diagnostic Commands

Run these commands to find out what's wrong:

### 1. Check Your Agent Status

```bash
curl https://class.xytek.ai/api/automation/agents/3 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Look for:**
- ✅ `"status": "active"` - Agent must be active
- ✅ `"isGmailConnected": true` - Gmail must be connected
- ✅ `"connectedEmail": "email@gmail.com"` - Should show email

**If agent status is NOT active:**
```bash
curl -X PATCH https://class.xytek.ai/api/automation/agents/3 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "status": "active" }'
```

---

### 2. Check Your Workflows

```bash
curl https://class.xytek.ai/api/automation/agents/3/workflows \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Look for:**
- ✅ At least one workflow returned
- ✅ `"status": "active"` - Workflow must be active
- ✅ `"actions"` includes `"type": "generate_ai_reply"`

**If no workflows:**
You need to create a workflow (see Step 4 below)

**If workflow status is NOT active:**
```bash
curl -X PUT https://class.xytek.ai/api/automation/workflows/WORKFLOW_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "status": "active" }'
```

---

### 3. Check Your AI Configuration

```bash
curl https://class.xytek.ai/api/ai-config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Look for:**
- ✅ At least one config returned
- ✅ `"provider": "openai"` or `"gemini"`
- ✅ `"api_key": "sk-..."` (first 10 chars shown)

**If no AI config:**
```bash
curl -X POST https://class.xytek.ai/api/ai-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-openai-api-key",
    "modelName": "gpt-4",
    "isDefault": true
  }'
```

---

### 4. Create/Recreate Workflow (If Needed)

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 3,
    "name": "AI Auto-Reply",
    "description": "Responds to emails with AI",
    "triggerConfig": {
      "type": "email_received"
    },
    "actions": [
      {
        "type": "generate_ai_reply",
        "config": {
          "systemPrompt": "You are a friendly assistant. Be helpful and professional. Keep responses under 100 words."
        }
      },
      {
        "type": "mark_as_read"
      }
    ],
    "status": "active"
  }'
```

---

## Common Issues & Fixes

### Issue 1: "No active workflows for this agent"

**Cause:** Either:
- Workflow status is not 'active'
- Agent status is not 'active'
- No workflow created

**Fix:**
```bash
# Check agent status
curl https://class.xytek.ai/api/automation/agents/3 -H "Authorization: Bearer YOUR_TOKEN"

# If not active, activate it
curl -X PATCH https://class.xytek.ai/api/automation/agents/3 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "status": "active" }'

# Check workflows
curl https://class.xytek.ai/api/automation/agents/3/workflows \
  -H "Authorization: Bearer YOUR_TOKEN"

# If no workflows, create one (see Step 4 above)
```

---

### Issue 2: "No new emails"

**Possible causes:**
- No emails have been sent to the agent's Gmail address
- Emails are being filtered out by workflow conditions

**Test:**
Send a test email to your agent's connected Gmail address:
```
To: amanullahnaqvi@gmail.com  (or your agent's email)
Subject: Test AI
Body: Hi! Can you respond to this?
```

Wait up to 60 seconds (polling interval).

---

### Issue 3: "No AI configuration found"

**Cause:** You haven't added your OpenAI/Gemini API key

**Fix:** Add AI configuration (see Step 3 above)

---

### Issue 4: Agent polls but doesn't respond

**Check logs on server:**
```bash
pm2 logs index | grep -A 20 "Polling a"
```

**Look for errors like:**
- "No AI configuration found" → Add AI config
- "OpenAI error" → Check API key is valid
- "Gmail error" → Reconnect Gmail OAuth

---

## Full Checklist

Run through this checklist:

```bash
# 1. Agent is active?
curl https://class.xytek.ai/api/automation/agents/3 -H "Authorization: Bearer YOUR_TOKEN" | grep '"status"'
# Should show: "status":"active"

# 2. Gmail is connected?
curl https://class.xytek.ai/api/automation/agents/3 -H "Authorization: Bearer YOUR_TOKEN" | grep 'isGmailConnected'
# Should show: "isGmailConnected":true

# 3. Has workflows?
curl https://class.xytek.ai/api/automation/agents/3/workflows -H "Authorization: Bearer YOUR_TOKEN"
# Should return at least one workflow

# 4. Workflow is active?
curl https://class.xytek.ai/api/automation/agents/3/workflows -H "Authorization: Bearer YOUR_TOKEN" | grep '"status"'
# Should show: "status":"active"

# 5. Has AI config?
curl https://class.xytek.ai/api/ai-config -H "Authorization: Bearer YOUR_TOKEN"
# Should return at least one config

# 6. Send test email
# Email to: amanullahnaqvi@gmail.com (or your agent's email)
# Subject: Test
# Body: Hi!

# 7. Wait 60 seconds and check executions
curl "https://class.xytek.ai/api/automation/executions?agentId=3&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## What Should Happen

**When everything is working:**

1. **Email arrives** at agent's Gmail (e.g., amanullahnaqvi@gmail.com)
2. **Polling service** (runs every 60 seconds) detects new email
3. **Workflow executes**:
   - Trigger: `email_received` ✅
   - Action 1: `generate_ai_reply` - AI reads email and generates reply
   - Action 2: `mark_as_read` - Marks email as read
4. **Reply sent** to original sender
5. **Execution logged** in database

**Check executions:**
```bash
curl "https://class.xytek.ai/api/automation/executions?agentId=3&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should show:
```json
{
  "executions": [
    {
      "id": 123,
      "agent_id": 3,
      "workflow_id": 1,
      "status": "completed",
      "trigger_data": {
        "email": {
          "from": "sender@example.com",
          "subject": "Test",
          "body": "Hi!"
        }
      },
      "execution_data": {
        "aiProvider": "openai",
        "aiModel": "gpt-4",
        "tokensUsed": 245,
        "generatedReply": "Hi there! Thank you for..."
      }
    }
  ]
}
```

---

## Still Not Working?

### Check Server Logs

```bash
# On your server
pm2 logs index --lines 100 | grep -A 10 "Polling a"
```

### Enable Debug Mode

Add this to your workflow to log more info:
```json
{
  "actions": [
    {
      "type": "generate_ai_reply",
      "config": {
        "systemPrompt": "You are a helpful assistant.",
        "temperature": 0.7
      }
    },
    {
      "type": "mark_as_read"
    }
  ]
}
```

### Test AI Config Separately

```bash
curl -X POST https://class.xytek.ai/api/ai-config/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-key",
    "modelName": "gpt-4"
  }'
```

Should return:
```json
{
  "success": true,
  "message": "Configuration test successful!"
}
```

---

## Quick Fix Script

Run this on your **LOCAL MACHINE** (replace YOUR_TOKEN):

```bash
#!/bin/bash
TOKEN="YOUR_JWT_TOKEN_HERE"
AGENT_ID=3

echo "🔍 Diagnosing Agent $AGENT_ID..."
echo ""

echo "1️⃣ Checking agent status..."
curl -s "https://class.xytek.ai/api/automation/agents/$AGENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.agent | {status, isGmailConnected, connectedEmail}'

echo ""
echo "2️⃣ Checking workflows..."
curl -s "https://class.xytek.ai/api/automation/agents/$AGENT_ID/workflows" \
  -H "Authorization: Bearer $TOKEN" | jq '.workflows[] | {id, name, status}'

echo ""
echo "3️⃣ Checking AI config..."
curl -s "https://class.xytek.ai/api/ai-config" \
  -H "Authorization: Bearer $TOKEN" | jq '.configs[] | {provider, model_name, is_default}'

echo ""
echo "4️⃣ Checking recent executions..."
curl -s "https://class.xytek.ai/api/automation/executions?agentId=$AGENT_ID&limit=3" \
  -H "Authorization: Bearer $TOKEN" | jq '.executions[] | {id, status, created_at}'

echo ""
echo "✅ Diagnostic complete!"
```

---

Need more help? Check the logs or create an issue!

