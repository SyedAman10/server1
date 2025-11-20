# 🤖 AI-Powered Email Automation Guide

This guide explains how to set up and use AI-powered email automation agents that can intelligently respond to emails using OpenAI or Google Gemini.

## Table of Contents
1. [Overview](#overview)
2. [Setup AI Configuration](#setup-ai-configuration)
3. [Create AI-Powered Agent](#create-ai-powered-agent)
4. [Customize AI Prompts](#customize-ai-prompts)
5. [Examples](#examples)
6. [API Reference](#api-reference)

---

## Overview

The AI automation system allows you to:
- **Configure AI Providers**: Set up OpenAI (GPT-4, GPT-3.5) or Google Gemini
- **Smart Replies**: AI reads incoming emails and generates contextual responses
- **Custom Prompts**: Define how the AI should respond (tone, style, rules)
- **Multiple Models**: Use different AI models for different agents

### How It Works

```
Incoming Email → Agent Trigger → AI Analyzes Email → Generates Reply → Sends Email
```

---

## Setup AI Configuration

### Step 1: Get Your AI API Key

#### For OpenAI:
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an account / Sign in
3. Navigate to **API Keys**
4. Click **Create new secret key**
5. Copy the key (starts with `sk-...`)

#### For Google Gemini:
1. Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Sign in with Google
3. Click **Create API Key**
4. Copy the key

### Step 2: Configure AI in Your Account

```bash
curl -X POST https://class.xytek.ai/api/ai-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-openai-api-key",
    "modelName": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 500,
    "isDefault": true
  }'
```

**Parameters:**
- `provider`: `"openai"`, `"gemini"`, or `"anthropic"`
- `apiKey`: Your API key from the provider
- `modelName`: 
  - OpenAI: `"gpt-4"`, `"gpt-4-turbo"`, `"gpt-3.5-turbo"`
  - Gemini: `"gemini-pro"`, `"gemini-1.5-pro"`
- `temperature`: 0.0 (focused) to 1.0 (creative), default 0.7
- `maxTokens`: Maximum response length (100-2000), default 500
- `isDefault`: Set as default AI config (boolean)

**Response:**
```json
{
  "success": true,
  "message": "openai configuration saved successfully",
  "config": {
    "id": 1,
    "user_id": 1,
    "provider": "openai",
    "api_key": "sk-proj-ab....",
    "model_name": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 500,
    "is_default": true
  },
  "testResult": "Configuration test successful!"
}
```

### Step 3: Verify Your Configuration

```bash
# List all your AI configurations
curl https://class.xytek.ai/api/ai-config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test a configuration before saving
curl -X POST https://class.xytek.ai/api/ai-config/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-key",
    "modelName": "gpt-4"
  }'
```

---

## Create AI-Powered Agent

### Example: Customer Support Agent

```bash
# 1. Create an inbound email agent
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Customer Support AI",
    "description": "Intelligent customer support agent",
    "type": "email_inbound"
  }'

# Response will include agentId

# 2. Create a workflow with AI reply action
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "agentId": 1,
    "name": "AI Auto-Reply Workflow",
    "trigger": {
      "type": "email_received",
      "config": {}
    },
    "conditions": [],
    "actions": [
      {
        "type": "generate_ai_reply",
        "config": {
          "provider": "openai",
          "systemPrompt": "You are a friendly customer support agent. Be helpful, professional, and concise. If you cannot help, ask them to contact support@company.com.",
          "temperature": 0.7,
          "maxTokens": 300
        }
      },
      {
        "type": "mark_as_read"
      }
    ]
  }'

# 3. Connect Gmail OAuth
# Visit the auth URL from agent creation response

# 4. Activate the agent
curl -X PATCH https://class.xytek.ai/api/automation/agents/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{ "status": "active" }'
```

---

## Customize AI Prompts

### System Prompt Examples

#### 1. **Professional Support Agent**
```
You are a professional customer support agent for XYTEK. 

Guidelines:
- Be friendly, helpful, and professional
- Keep responses under 150 words
- If you need more information, ask clarifying questions
- For technical issues, ask them to provide details
- For billing questions, direct them to billing@xytek.com
- Always end with "Best regards, XYTEK Support Team"
```

#### 2. **Sales Assistant**
```
You are a sales assistant for our SaaS product.

Guidelines:
- Be enthusiastic but not pushy
- Highlight key benefits: automation, time-saving, easy integration
- Pricing: Starter ($29/mo), Pro ($99/mo), Enterprise (custom)
- If they're interested, invite them to book a demo: https://calendly.com/xytek
- Use a conversational, friendly tone
```

#### 3. **HR Recruiter**
```
You are an HR recruiter for XYTEK.

Guidelines:
- Be professional and welcoming
- For job applications: acknowledge receipt and say we'll review in 3-5 business days
- For questions about positions: provide general info and direct to careers page
- For interview scheduling: offer 3 time slots
- Keep tone warm but professional
```

#### 4. **Appointment Scheduler**
```
You are an appointment scheduling assistant.

Guidelines:
- Available hours: Monday-Friday, 9 AM - 5 PM EST
- Each appointment is 30 minutes
- Ask for their preferred date and time
- Confirm email and phone number
- Provide Zoom link: https://zoom.us/j/123456789
- Be concise and clear
```

---

## Examples

### Example 1: Basic Auto-Reply

**Incoming Email:**
```
Subject: Question about your product
From: customer@example.com

Hi, I'm interested in your automation platform. 
Can you tell me more about pricing and features?
```

**AI Workflow:**
```json
{
  "actions": [
    {
      "type": "generate_ai_reply",
      "config": {
        "systemPrompt": "You are a friendly sales assistant. Provide pricing info: Starter ($29/mo), Pro ($99/mo), Enterprise (custom). Mention key features: email automation, AI integration, analytics. Invite them to book a demo."
      }
    }
  ]
}
```

**AI Response:**
```
Hi there!

Thank you for your interest in our automation platform! 

Here's our pricing:
• Starter Plan: $29/month - Perfect for small teams
• Pro Plan: $99/month - Advanced features and integrations
• Enterprise: Custom pricing for larger organizations

Key features include:
✓ Email automation with AI
✓ Smart workflows and triggers
✓ Real-time analytics
✓ Seamless integrations

Would you like to schedule a demo? You can book a time here: https://calendly.com/xytek

Feel free to reach out if you have any questions!

Best regards,
XYTEK Team
```

---

### Example 2: Conditional AI Reply

Only reply to support emails, not sales:

```json
{
  "trigger": {
    "type": "email_received"
  },
  "conditions": [
    {
      "field": "subject",
      "operator": "contains",
      "value": "support"
    }
  ],
  "actions": [
    {
      "type": "generate_ai_reply",
      "config": {
        "systemPrompt": "You are a technical support agent. Help troubleshoot issues. Ask for error messages, screenshots, or logs if needed. Be patient and clear."
      }
    },
    {
      "type": "add_label",
      "config": { "labelId": "Label_Support" }
    }
  ]
}
```

---

### Example 3: Different Tones for Different Emails

**Workflow 1: Formal Responses**
```json
{
  "conditions": [
    { "field": "from", "operator": "contains", "value": "@enterprise.com" }
  ],
  "actions": [
    {
      "type": "generate_ai_reply",
      "config": {
        "systemPrompt": "You are a professional business representative. Use formal language. Address recipient as 'Dear [Name]'. Sign off with 'Sincerely, [Your Company]'.",
        "temperature": 0.5
      }
    }
  ]
}
```

**Workflow 2: Casual Responses**
```json
{
  "conditions": [
    { "field": "subject", "operator": "contains", "value": "quick question" }
  ],
  "actions": [
    {
      "type": "generate_ai_reply",
      "config": {
        "systemPrompt": "You are a friendly, casual assistant. Use a conversational tone. Keep it brief and to the point.",
        "temperature": 0.9
      }
    }
  ]
}
```

---

## API Reference

### AI Configuration Endpoints

#### Create/Update AI Config
```
POST /api/ai-config
Headers: Authorization: Bearer <token>
Body: {
  "provider": "openai" | "gemini" | "anthropic",
  "apiKey": "string",
  "modelName": "string",
  "temperature": 0.7,
  "maxTokens": 500,
  "isDefault": boolean
}
```

#### Get All AI Configs
```
GET /api/ai-config
Headers: Authorization: Bearer <token>
```

#### Get Specific AI Config
```
GET /api/ai-config/:provider
Headers: Authorization: Bearer <token>
```

#### Delete AI Config
```
DELETE /api/ai-config/:provider
Headers: Authorization: Bearer <token>
```

#### Test AI Config
```
POST /api/ai-config/test
Headers: Authorization: Bearer <token>
Body: {
  "provider": "openai",
  "apiKey": "sk-...",
  "modelName": "gpt-4"
}
```

---

### Workflow Action: generate_ai_reply

```json
{
  "type": "generate_ai_reply",
  "config": {
    "provider": "openai",           // Optional: uses default if not specified
    "systemPrompt": "Your custom instructions here",
    "temperature": 0.7,             // Optional: overrides default
    "maxTokens": 300                // Optional: overrides default
  }
}
```

**Available Template Variables in systemPrompt:**
- `{{email.from}}` - Sender email
- `{{email.subject}}` - Email subject
- `{{email.date}}` - Email date

Example:
```json
{
  "systemPrompt": "You are replying to {{email.from}}. Keep it brief and friendly."
}
```

---

## Best Practices

### 1. **Start with Clear Instructions**
```
BAD:  "Be helpful"
GOOD: "You are a customer support agent. Answer questions about our product. 
       For billing issues, direct to billing@company.com. Keep responses under 100 words."
```

### 2. **Set Appropriate Temperature**
- **0.3-0.5**: Consistent, predictable responses (support, facts)
- **0.6-0.8**: Balanced creativity (general communication)
- **0.9-1.0**: Creative, varied responses (marketing, sales)

### 3. **Use Conditions to Filter**
Don't let AI reply to everything. Use conditions:
```json
{
  "conditions": [
    { "field": "subject", "operator": "not_contains", "value": "urgent" },
    { "field": "from", "operator": "not_contains", "value": "@competitor.com" }
  ]
}
```

### 4. **Test Before Activating**
```bash
# Test your AI config first
curl -X POST https://class.xytek.ai/api/ai-config/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "provider": "openai", "apiKey": "sk-...", "modelName": "gpt-4" }'
```

### 5. **Monitor Token Usage**
Check execution logs to see token usage:
```bash
curl https://class.xytek.ai/api/automation/executions?agentId=1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Troubleshooting

### Error: "No AI configuration found"
**Solution:** Set up your AI config first:
```bash
curl -X POST https://class.xytek.ai/api/ai-config -d '{"provider":"openai","apiKey":"sk-..."}' ...
```

### Error: "AI configuration test failed"
**Solution:** Check your API key is valid and has credits/quota remaining.

### AI replies are too generic
**Solution:** Make your system prompt more specific:
```json
{
  "systemPrompt": "You are Sarah, a customer support agent at XYTEK with 5 years experience. 
                   You specialize in automation workflows. Be friendly but professional. 
                   Use specific examples when possible."
}
```

### AI replies are too long
**Solution:** Reduce `maxTokens` and add length instruction:
```json
{
  "systemPrompt": "Keep responses under 50 words. Be concise.",
  "maxTokens": 150
}
```

---

## Cost Considerations

### OpenAI Pricing (as of 2024)
- **GPT-4**: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- **GPT-3.5-turbo**: ~$0.001 per 1K input tokens, ~$0.002 per 1K output tokens

### Google Gemini Pricing
- **Gemini Pro**: Free tier available, paid tiers vary

### Estimate Costs
- Average email: ~300 tokens input
- Average reply: ~200 tokens output
- **GPT-4**: ~$0.02 per email reply
- **GPT-3.5**: ~$0.001 per email reply

**Recommendation:** Start with GPT-3.5-turbo for testing, upgrade to GPT-4 for production.

---

## Security Notes

🔒 **Your API keys are encrypted and never exposed in responses**

- API keys are stored securely in the database
- Only the first 10 characters are returned in API responses
- Each user's AI configs are isolated
- API keys are never logged

---

## Need Help?

- 📧 Email: support@xytek.ai
- 📚 Docs: https://docs.xytek.ai
- 💬 Discord: https://discord.gg/xytek

Happy automating! 🚀

