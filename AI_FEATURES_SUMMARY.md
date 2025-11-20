# 🤖 AI Email Automation - Quick Summary

## What's Been Added

### 1. **AI Configuration System**
Users can now store their AI provider credentials (OpenAI, Gemini, Anthropic).

**New Database Table:**
```sql
CREATE TABLE ai_configurations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  provider VARCHAR(50),  -- 'openai', 'gemini', 'anthropic'
  api_key TEXT,
  model_name VARCHAR(100),  -- 'gpt-4', 'gemini-pro', etc.
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  is_default BOOLEAN DEFAULT false
);
```

### 2. **New Workflow Action: `generate_ai_reply`**

**Example Usage:**
```json
{
  "type": "generate_ai_reply",
  "config": {
    "systemPrompt": "You are a friendly support agent. Be helpful and concise.",
    "temperature": 0.7,
    "maxTokens": 300
  }
}
```

**What It Does:**
1. Reads incoming email
2. Sends email content to AI (OpenAI/Gemini)
3. AI generates contextual reply based on your prompt
4. Sends professional email back to sender

### 3. **New API Endpoints**

```
POST   /api/ai-config              - Create/update AI configuration
GET    /api/ai-config              - Get all AI configs
GET    /api/ai-config/:provider    - Get specific AI config
DELETE /api/ai-config/:provider    - Delete AI config
POST   /api/ai-config/test         - Test AI config before saving
```

### 4. **New Files Created**

```
scripts/add-ai-config-table.js          - Database migration
models/aiConfiguration.model.js         - AI config data layer
services/automation/aiService.js        - AI integration service
controllers/aiConfig.controller.js      - API controller
routes/aiConfig.routes.js               - API routes
AI_AUTOMATION_GUIDE.md                  - Complete documentation
DEPLOY_AI_AUTOMATION.md                 - Deployment instructions
```

---

## Quick Start

### 1. Deploy to Server

```bash
cd /home/ubuntu/server1
git pull
npm install openai @google/generative-ai
node scripts/add-ai-config-table.js
pm2 restart index
```

### 2. Set Up AI Configuration

```bash
curl -X POST https://class.xytek.ai/api/ai-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-api-key",
    "modelName": "gpt-4",
    "isDefault": true
  }'
```

### 3. Create AI Agent

```bash
# Create agent
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "AI Support",
    "type": "email_inbound"
  }'

# Create workflow with AI action
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 1,
    "name": "AI Auto-Reply",
    "trigger": { "type": "email_received" },
    "actions": [
      {
        "type": "generate_ai_reply",
        "config": {
          "systemPrompt": "You are a helpful assistant. Be friendly and professional."
        }
      },
      { "type": "mark_as_read" }
    ]
  }'
```

### 4. Test It

Send an email to your agent's Gmail address and wait for the AI-generated reply!

---

## Use Cases

### 1. **Customer Support**
```json
{
  "systemPrompt": "You are a customer support agent. Help with product questions. For billing, direct to billing@company.com."
}
```

### 2. **Sales Assistant**
```json
{
  "systemPrompt": "You are a sales assistant. Share pricing: Starter ($29), Pro ($99), Enterprise (custom). Invite to book demo."
}
```

### 3. **Appointment Scheduler**
```json
{
  "systemPrompt": "You schedule appointments. Available Mon-Fri 9-5 EST. Ask for preferred date/time."
}
```

### 4. **HR Recruiter**
```json
{
  "systemPrompt": "You are an HR recruiter. Acknowledge job applications. Say we'll review in 3-5 days."
}
```

---

## Configuration Options

### Temperature
- **0.3**: Consistent, predictable (support, facts)
- **0.7**: Balanced (default, general use)
- **1.0**: Creative, varied (marketing, sales)

### Max Tokens
- **150**: Brief replies (~50 words)
- **300**: Standard replies (~100 words)
- **500**: Detailed replies (~200 words)

### Providers
- **OpenAI**: GPT-4 ($0.02/email), GPT-3.5 ($0.001/email)
- **Gemini**: Free tier available
- **Anthropic**: Claude models (future)

---

## Monitoring

### Check Executions
```bash
curl https://class.xytek.ai/api/automation/executions?agentId=1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Token Usage
```json
{
  "execution_data": {
    "aiProvider": "openai",
    "aiModel": "gpt-4",
    "tokensUsed": 245,
    "generatedReply": "Thank you for your email..."
  }
}
```

---

## Security

- ✅ API keys are encrypted in database
- ✅ Only first 10 characters shown in API responses
- ✅ API keys never logged
- ✅ Per-user isolation
- ✅ Config testing before saving

---

## Documentation

- **Complete Guide**: `AI_AUTOMATION_GUIDE.md`
- **Deployment**: `DEPLOY_AI_AUTOMATION.md`
- **General Automation**: `AUTOMATION_SYSTEM_GUIDE.md`

---

## What Changed from Basic Auto-Reply

### Before (Static Reply):
```json
{
  "type": "reply_to_email",
  "config": {
    "replyBody": "Thank you for your email!"  // Same every time
  }
}
```

### After (AI Reply):
```json
{
  "type": "generate_ai_reply",
  "config": {
    "systemPrompt": "Be helpful and professional"  // AI reads email & responds contextually
  }
}
```

**Example:**

**Email 1:** "What's your pricing?"  
**AI Reply:** "Our pricing starts at $29/month for the Starter plan..."

**Email 2:** "I need help with integration"  
**AI Reply:** "I'd be happy to help with integration! Could you tell me which platform..."

---

## Cost Example

**Scenario:** 100 emails/day with GPT-4

- 100 emails × $0.02 = **$2/day**
- 30 days × $2 = **$60/month**

**With GPT-3.5-turbo:**
- 100 emails × $0.001 = **$0.10/day**
- 30 days × $0.10 = **$3/month**

---

## Next Steps

1. ✅ Deploy to server
2. ✅ Set up AI config
3. ✅ Create AI agent
4. ✅ Test with real emails
5. 📈 Monitor and optimize prompts

Happy automating! 🚀

