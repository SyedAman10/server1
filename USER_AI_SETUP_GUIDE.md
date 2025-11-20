# 🤖 Setting Up Your AI-Powered Email Agent

This guide will help you set up AI-powered email automation using your own OpenAI or Google Gemini API key.

---

## Step 1: Get Your API Key

### Option A: OpenAI (GPT-4, GPT-3.5)

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Click your profile → **View API keys**
4. Click **Create new secret key**
5. Copy the key (starts with `sk-...`)
6. Add payment method if needed

**Pricing:**
- GPT-3.5-turbo: $0.001 per email (~$3/month for 100 emails/day)
- GPT-4: $0.02 per email (~$60/month for 100 emails/day)

### Option B: Google Gemini (Free Tier Available)

1. Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Sign in with Google
3. Click **Create API Key**
4. Copy the key
5. Free tier: 60 requests/minute

---

## Step 2: Configure AI in Your Account

### Via API:

```bash
curl -X POST https://class.xytek.ai/api/ai-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-api-key-here",
    "modelName": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 500,
    "isDefault": true
  }'
```

### Via Frontend (Coming Soon):

Go to **Settings → AI Configuration** and fill in:
- **Provider**: OpenAI, Gemini, or Anthropic
- **API Key**: Your key from Step 1
- **Model**: GPT-4, GPT-3.5-turbo, or Gemini Pro
- **Temperature**: 0.7 (balanced creativity)
- **Max Tokens**: 500 (response length)

Click **Save & Test** to verify it works!

---

## Step 3: Create Your AI Agent

### 3.1 Create the Agent

```bash
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Customer Support AI",
    "description": "Intelligent email assistant",
    "type": "email_inbound"
  }'
```

**Save the `agentId` from the response!**

### 3.2 Create AI Workflow

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
          "systemPrompt": "You are a friendly customer support agent. Be helpful and professional. Keep responses under 100 words. For urgent issues, tell them to contact support@company.com."
        }
      },
      {
        "type": "mark_as_read"
      }
    ]
  }'
```

### 3.3 Connect Gmail

```bash
# Get authorization URL
curl https://class.xytek.ai/api/automation/agents/1/gmail/auth-url \
  -H "Authorization: Bearer YOUR_TOKEN"

# Visit the URL and authorize Gmail access
```

### 3.4 Activate Agent

```bash
curl -X PATCH https://class.xytek.ai/api/automation/agents/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "status": "active" }'
```

---

## Step 4: Test Your AI Agent

Send a test email to your connected Gmail address:

**Test Email:**
```
To: your-agent@gmail.com
Subject: Test AI Reply
Body: Hi! Can you tell me about your pricing plans?
```

**Expected AI Response (within 60 seconds):**
```
Hi there!

Thank you for your interest! Here's information about 
our pricing plans:

[AI will generate a contextual response based on your prompt]

Best regards,
Support Team
```

---

## Customizing Your AI Prompt

### Example Prompts:

#### 1. Professional Support
```json
{
  "systemPrompt": "You are a professional customer support agent for [Your Company]. Be friendly, helpful, and concise. For technical issues, ask for error messages or screenshots. For billing questions, direct users to billing@company.com. Always end with 'Best regards, [Company] Support Team'."
}
```

#### 2. Sales Assistant
```json
{
  "systemPrompt": "You are a sales assistant for our SaaS product. Pricing: Starter ($29/mo), Pro ($99/mo), Enterprise (custom). Highlight benefits: automation, time-saving, easy integration. Invite prospects to book a demo at calendly.com/yourlink. Be enthusiastic but not pushy."
}
```

#### 3. Appointment Scheduler
```json
{
  "systemPrompt": "You schedule appointments for our team. Available hours: Monday-Friday, 9 AM - 5 PM EST. Each appointment is 30 minutes. Ask for their preferred date and time, confirm their email and phone number, and provide our Zoom link: zoom.us/j/123456789"
}
```

#### 4. Quick FAQ Bot
```json
{
  "systemPrompt": "You answer common questions. Our product is an email automation platform. Pricing: $29-$99/month. Free trial: 14 days. Support email: support@company.com. Integration: Works with Gmail, Outlook, Zapier. Keep responses under 50 words."
}
```

---

## Managing Your AI Configuration

### View Your Current Config

```bash
curl https://class.xytek.ai/api/ai-config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Your Config

```bash
curl -X POST https://class.xytek.ai/api/ai-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-new-key",
    "modelName": "gpt-3.5-turbo",
    "temperature": 0.8
  }'
```

### Delete Your Config

```bash
curl -X DELETE https://class.xytek.ai/api/ai-config/openai \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Understanding Settings

### Temperature (0.0 - 1.0)
- **0.3**: Consistent, predictable responses (support, facts)
- **0.7**: Balanced creativity (default, general use)
- **1.0**: More creative, varied responses (marketing, sales)

### Max Tokens
- **150**: Brief replies (~50 words)
- **300**: Standard replies (~100 words)
- **500**: Detailed replies (~200 words)

### Models

**OpenAI:**
- `gpt-4`: Most capable, best quality ($0.02/email)
- `gpt-4-turbo`: Faster GPT-4 variant
- `gpt-3.5-turbo`: Fast and cheap ($0.001/email)

**Google Gemini:**
- `gemini-pro`: Free tier available
- `gemini-1.5-pro`: Enhanced capabilities

---

## Monitoring Usage

### Check Recent Executions

```bash
curl https://class.xytek.ai/api/automation/executions?agentId=1&limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Token Usage

Each execution shows:
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

## Billing & Costs

### You Pay Your AI Provider Directly

- **OpenAI**: Charges your OpenAI account
- **Google**: Charges your Google Cloud account
- **Platform Fee**: No additional AI costs from us!

### Estimate Your Monthly Cost

**Scenario:** 100 emails/day

**With GPT-4:**
- 100 emails × $0.02 = $2/day
- $2 × 30 days = **$60/month**

**With GPT-3.5-turbo:**
- 100 emails × $0.001 = $0.10/day
- $0.10 × 30 days = **$3/month**

**Tip:** Start with GPT-3.5-turbo for testing!

---

## Troubleshooting

### "No AI configuration found"
**Solution:** Add your AI config (Step 2)

### "Invalid API key"
**Solution:** 
1. Check key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Verify you have credits/quota
3. Update config with correct key

### "Rate limit exceeded"
**Solution:**
- OpenAI: Upgrade to paid tier or reduce email volume
- Gemini: Wait 1 minute (free tier: 60 requests/minute)

### AI replies are too generic
**Solution:** Make your prompt more specific:
```json
{
  "systemPrompt": "You are Sarah, a customer support agent with 5 years experience in automation software. Use specific examples when helping customers. Be warm but professional."
}
```

### AI replies are too long
**Solution:**
```json
{
  "systemPrompt": "Keep all responses under 50 words. Be concise and direct.",
  "maxTokens": 150
}
```

---

## Security & Privacy

🔒 **Your API key is secure:**
- Encrypted in our database
- Only you can access it
- Never shared with other users
- Not visible in logs

🔐 **Your data:**
- Email content is sent to your chosen AI provider (OpenAI/Google)
- Subject to their privacy policies
- Not stored permanently by us

---

## Need Help?

- 📧 **Support**: support@xytek.ai
- 📚 **Docs**: [Full Documentation](AI_AUTOMATION_GUIDE.md)
- 💬 **Community**: [Discord](https://discord.gg/xytek)

---

## Quick Reference

```bash
# Configure AI
POST /api/ai-config

# View configs
GET /api/ai-config

# Create agent
POST /api/automation/agents

# Create workflow
POST /api/automation/workflows

# Connect Gmail
GET /api/automation/agents/:id/gmail/auth-url

# Activate agent
PATCH /api/automation/agents/:id

# View executions
GET /api/automation/executions?agentId=:id
```

---

Happy automating! 🚀

