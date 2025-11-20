# 🚀 Deploy AI-Powered Email Automation

Follow these steps to deploy the new AI automation feature to your server.

---

## 📦 What's New

✅ **AI Configuration System** - Store OpenAI/Gemini API keys per user  
✅ **AI Reply Action** - `generate_ai_reply` workflow action  
✅ **Custom Prompts** - Define how AI should respond  
✅ **Multiple Providers** - Support for OpenAI, Google Gemini, Anthropic  
✅ **Smart Context** - AI reads email content and generates relevant replies  

---

## 🔧 Deployment Steps

### Step 1: Update Dependencies

```bash
cd /home/ubuntu/server1
npm install openai@latest @google/generative-ai@latest
```

### Step 2: Run Database Migration

```bash
node scripts/add-ai-config-table.js
```

Expected output:
```
🚀 Starting to add AI configuration table...
✅ AI configurations table created
✅ AI configurations indexes created
🎉 AI configuration table added successfully!
```

### Step 3: Restart Application

```bash
pm2 restart index
pm2 logs index --lines 50
```

Verify you see:
```
✅ Database connected successfully
📧 Starting email polling service...
🚀 Server is running on port 3000
```

### Step 4: Verify API Endpoints

```bash
# Test the new AI config endpoint
curl https://class.xytek.ai/api/ai-config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "configs": []
}
```

---

## 🧪 Testing

### 1. Set Up AI Configuration

Get your OpenAI API key from https://platform.openai.com

```bash
curl -X POST https://class.xytek.ai/api/ai-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-openai-api-key-here",
    "modelName": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 500,
    "isDefault": true
  }'
```

### 2. Create AI-Powered Agent

```bash
# Create agent
AGENT_RESPONSE=$(curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "AI Support Agent",
    "description": "Intelligent auto-reply agent",
    "type": "email_inbound"
  }')

echo $AGENT_RESPONSE
# Extract agent ID from response
```

### 3. Create AI Workflow

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 1,
    "name": "AI Auto-Reply",
    "trigger": {
      "type": "email_received"
    },
    "actions": [
      {
        "type": "generate_ai_reply",
        "config": {
          "systemPrompt": "You are a friendly customer support agent. Be helpful and professional. Keep responses under 100 words.",
          "temperature": 0.7,
          "maxTokens": 300
        }
      },
      {
        "type": "mark_as_read"
      }
    ]
  }'
```

### 4. Connect Gmail & Activate

```bash
# Get auth URL
curl https://class.xytek.ai/api/automation/agents/1/gmail/auth-url \
  -H "Authorization: Bearer YOUR_TOKEN"

# Visit the URL, authorize Gmail

# Activate agent
curl -X PATCH https://class.xytek.ai/api/automation/agents/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "status": "active" }'
```

### 5. Test It!

Send an email to the connected Gmail address:

**Test Email:**
```
To: amanullahnaqvi@gmail.com
Subject: Test AI Reply
Body: Hi! Can you tell me about your services?
```

**Expected AI Response (within 60 seconds):**
```
Hi there!

Thank you for reaching out! We specialize in automation 
solutions that help businesses streamline their workflows 
and improve efficiency.

Our services include:
• Email automation
• AI-powered responses
• Custom integrations
• Analytics and reporting

Would you like to learn more about a specific service?

Best regards,
Support Team
```

---

## 📊 Monitor Executions

```bash
# Check recent executions
curl https://class.xytek.ai/api/automation/executions?agentId=1&limit=5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Look for:
```json
{
  "id": 123,
  "status": "completed",
  "trigger_data": { "email": {...} },
  "execution_data": {
    "aiProvider": "openai",
    "aiModel": "gpt-4",
    "tokensUsed": 245,
    "generatedReply": "..."
  }
}
```

---

## 🔍 Troubleshooting

### Issue: "No AI configuration found"

**Cause:** No AI config set up for the user.

**Fix:**
```bash
curl -X POST https://class.xytek.ai/api/ai-config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"provider":"openai","apiKey":"sk-...","isDefault":true}'
```

### Issue: "OpenAI error: Incorrect API key provided"

**Cause:** Invalid API key.

**Fix:** 
1. Verify key at https://platform.openai.com/api-keys
2. Update configuration:
```bash
curl -X POST https://class.xytek.ai/api/ai-config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"provider":"openai","apiKey":"sk-NEW-KEY"}'
```

### Issue: AI replies not being sent

**Check:**
1. Agent is `active`: `GET /api/automation/agents/1`
2. Workflow has `generate_ai_reply` action
3. Gmail is connected: Check `isGmailConnected` in agent response
4. Logs: `pm2 logs index | grep "Generating AI reply"`

---

## 💰 Cost Monitoring

### OpenAI Token Usage

Each email typically uses:
- Input: ~300 tokens (email context)
- Output: ~200 tokens (reply)
- **Total: ~500 tokens per email**

**GPT-4 Costs:**
- Input: $0.03 per 1K tokens
- Output: $0.06 per 1K tokens
- **~$0.02 per email reply**

**GPT-3.5-turbo Costs:**
- Input: $0.001 per 1K tokens
- Output: $0.002 per 1K tokens
- **~$0.001 per email reply**

### Track Your Usage

Check execution logs:
```bash
curl https://class.xytek.ai/api/automation/executions?agentId=1 \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.executions[] | {date, tokensUsed}'
```

---

## 📝 Next Steps

1. **Test with different prompts** - Experiment with tone and style
2. **Set up conditions** - Only reply to certain emails
3. **Monitor costs** - Check token usage regularly
4. **Add multiple configs** - Use GPT-4 for important emails, GPT-3.5 for simple ones
5. **Read the guide** - Check `AI_AUTOMATION_GUIDE.md` for examples

---

## 🎉 You're All Set!

Your AI-powered email automation is now live!

**What happens next:**
1. Every 60 seconds, the system checks for new emails
2. AI analyzes each email
3. Generates contextual reply based on your prompt
4. Sends professional response
5. Marks email as read

---

## 📚 Resources

- **Full Guide**: `AI_AUTOMATION_GUIDE.md`
- **API Docs**: `AUTOMATION_SYSTEM_GUIDE.md`
- **OpenAI Docs**: https://platform.openai.com/docs
- **Gemini Docs**: https://ai.google.dev/docs

Need help? Email support@xytek.ai 🚀

