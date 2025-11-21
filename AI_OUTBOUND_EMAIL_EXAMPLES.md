# 🤖 AI-Powered Outbound Email Examples

Complete examples for using AI to generate outbound email content.

---

## ✅ What's New

**AI is now available for outbound emails!**

- ✅ `generate_ai_content` action added
- ✅ Works with OpenAI (GPT-4, GPT-3.5)
- ✅ Works with Google Gemini
- ✅ Supports variable replacement
- ✅ Chain with `send_email` action

---

## 🚀 Quick Start

### **Example 1: AI-Generated Marketing Email**

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 10,
    "name": "AI Marketing Campaign",
    "triggerConfig": {
      "type": "manual"
    },
    "actions": [
      {
        "type": "generate_ai_content",
        "config": {
          "prompt": "Write a marketing email about {{product_name}}. Highlight: {{benefits}}. Include a call-to-action. Keep it under 150 words and friendly.",
          "temperature": 0.7,
          "maxTokens": 300,
          "systemPrompt": "You are a professional marketing copywriter. Write engaging, benefit-focused emails that convert."
        }
      },
      {
        "type": "send_email",
        "config": {
          "to": "{{recipient}}",
          "subject": "Discover {{product_name}} - Perfect for You!",
          "body": "{{ai_content}}"
        }
      }
    ],
    "status": "active"
  }'
```

**Trigger it:**
```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/7/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "data": {
      "recipient": "customer@example.com",
      "product_name": "XYTEK AI Classroom",
      "benefits": "automated grading, AI teaching assistant, real-time insights"
    }
  }'
```

---

### **Example 2: Personalized Follow-Up**

```json
{
  "agentId": 10,
  "name": "AI Follow-Up",
  "triggerConfig": {
    "type": "manual"
  },
  "actions": [
    {
      "type": "generate_ai_content",
      "config": {
        "prompt": "Write a friendly follow-up email to {{name}} who {{action_taken}}. Ask for their feedback and offer help. Be warm and conversational. Under 100 words.",
        "temperature": 0.8,
        "maxTokens": 250
      }
    },
    {
      "type": "send_email",
      "config": {
        "to": "{{email}}",
        "subject": "How did it go, {{name}}?",
        "body": "{{ai_content}}"
      }
    }
  ]
}
```

**Trigger:**
```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/8/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "data": {
      "email": "john@example.com",
      "name": "John",
      "action_taken": "attended our webinar on AI automation"
    }
  }'
```

**AI will generate something like:**
```
Hi John,

Hope you enjoyed the webinar on AI automation! We'd love to hear your thoughts on what you learned.

Is there anything you'd like to dive deeper into? I'm here to help!

Looking forward to hearing from you.

Best regards
```

---

### **Example 3: Daily AI Newsletter**

```json
{
  "agentId": 10,
  "name": "Daily AI Digest",
  "triggerConfig": {
    "type": "schedule",
    "schedule": {
      "frequency": "daily",
      "time": "08:00"
    }
  },
  "actions": [
    {
      "type": "generate_ai_content",
      "config": {
        "prompt": "Create a brief morning newsletter for {{date}}. Include: 1) A motivational quote, 2) Today's tip for productivity, 3) A quick reminder about {{company_goal}}. Keep it energizing and under 150 words.",
        "temperature": 0.7,
        "maxTokens": 300,
        "systemPrompt": "You are an inspiring team leader. Write motivational, actionable content."
      }
    },
    {
      "type": "send_email",
      "config": {
        "to": ["team@xytek.ai"],
        "subject": "Good Morning! ☀️ - {{date}}",
        "body": "{{ai_content}}"
      }
    }
  ]
}
```

---

### **Example 4: AI Product Announcements**

```json
{
  "agentId": 10,
  "name": "AI Product Launch",
  "triggerConfig": {
    "type": "manual"
  },
  "actions": [
    {
      "type": "generate_ai_content",
      "config": {
        "prompt": "Write an exciting product launch email for {{feature_name}}. Target audience: {{audience}}. Key benefits: {{benefits}}. Tone: {{tone}}. Include a clear CTA. Under 200 words.",
        "temperature": 0.8,
        "maxTokens": 400
      }
    },
    {
      "type": "send_email",
      "config": {
        "to": "{{recipient_list}}",
        "subject": "🚀 Introducing {{feature_name}}!",
        "body": "{{ai_content}}",
        "isHtml": false
      }
    }
  ]
}
```

**Trigger:**
```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/9/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "data": {
      "recipient_list": "subscribers@list.com",
      "feature_name": "AI Email Assistant",
      "audience": "busy professionals",
      "benefits": "saves 5 hours/week, instant replies, learns your style",
      "tone": "professional but friendly"
    }
  }'
```

---

## 🎨 Customizing AI Behavior

### **Temperature Settings**

```json
{
  "temperature": 0.3,  // More focused, consistent (good for facts, reports)
  "temperature": 0.7,  // Balanced creativity (good for general emails)
  "temperature": 0.9   // More creative, varied (good for marketing)
}
```

### **Max Tokens**

```json
{
  "maxTokens": 100,   // ~75 words (brief)
  "maxTokens": 300,   // ~225 words (medium)
  "maxTokens": 500    // ~375 words (detailed)
}
```

### **System Prompts**

Guide the AI's writing style:

```json
{
  "systemPrompt": "You are a professional email writer. Keep emails concise and actionable."
}

{
  "systemPrompt": "You are a friendly customer support rep. Be warm, empathetic, and helpful."
}

{
  "systemPrompt": "You are a marketing expert. Write persuasive, benefit-focused copy."
}

{
  "systemPrompt": "You are a technical writer. Be clear, precise, and jargon-free."
}
```

---

## 💰 Token Usage & Cost

### **Estimated Costs (GPT-4)**

| Email Length | Tokens | Cost per Email |
|--------------|--------|----------------|
| Short (100 words) | ~150 | $0.0045 |
| Medium (200 words) | ~300 | $0.0090 |
| Long (400 words) | ~600 | $0.0180 |

### **Estimated Costs (GPT-3.5 Turbo)**

| Email Length | Tokens | Cost per Email |
|--------------|--------|----------------|
| Short (100 words) | ~150 | $0.0002 |
| Medium (200 words) | ~300 | $0.0004 |
| Long (400 words) | ~600 | $0.0008 |

**Note:** Uses your own API keys, so you control costs!

---

## 📊 Variables You Can Use

After `generate_ai_content` runs, these variables are available:

| Variable | Description |
|----------|-------------|
| `{{ai_content}}` | The generated email content |
| `{{ai_provider}}` | Provider used (openai, gemini) |
| `{{ai_model}}` | Model used (gpt-4, gemini-pro) |
| `{{ai_tokens_used}}` | Number of tokens consumed |

**Example:**
```json
{
  "type": "send_email",
  "config": {
    "to": "user@example.com",
    "subject": "Your Report",
    "body": "{{ai_content}}\n\n---\nGenerated by {{ai_model}} ({{ai_tokens_used}} tokens)"
  }
}
```

---

## 🔧 Deployment

After making changes, deploy:

```bash
cd /home/ubuntu/server1
git pull
pm2 restart index
pm2 logs index --lines 20
```

---

## 🧪 Testing

### **Test AI Content Generation**

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/7/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "data": {
      "recipient": "your-test-email@gmail.com",
      "product_name": "Test Product",
      "benefits": "amazing features, great value"
    }
  }'
```

Check your inbox for the AI-generated email!

---

## ⚠️ Best Practices

### **1. Keep Prompts Clear**
✅ Good: "Write a marketing email about {{product}}. Include benefits and CTA. Under 150 words."
❌ Bad: "Write something about our product"

### **2. Set Appropriate Limits**
✅ Use `maxTokens` to control length
✅ Use `temperature` to control creativity

### **3. Review First Sends**
✅ Always test with your own email first
✅ Review AI-generated content before bulk sending

### **4. Monitor Costs**
✅ Check `ai_tokens_used` in execution logs
✅ Use GPT-3.5 for high-volume, simple emails
✅ Use GPT-4 for complex, important emails

### **5. Personalize**
✅ Use variables: `{{name}}`, `{{company}}`, etc.
✅ The more context you provide, the better the AI output

---

## 🆚 Comparison: Inbound vs Outbound AI

| Feature | **Inbound AI** 📥 | **Outbound AI** 📤 |
|---------|-------------------|-------------------|
| **Action** | `generate_ai_reply` | `generate_ai_content` |
| **Input** | Incoming email body | Your custom prompt |
| **Context** | Email metadata (from, subject) | Variables you provide |
| **Use Case** | Auto-reply to customers | Marketing, newsletters |
| **Trigger** | Email received | Manual or schedule |

---

## 🚀 Complete Workflow Example

Here's everything together - AI-powered outbound marketing:

```bash
# 1. Create outbound agent
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "AI Marketing Agent",
    "type": "email_outbound",
    "config": {"provider": "gmail"}
  }'

# 2. Connect Gmail (get auth URL and visit it)
curl -X GET https://class.xytek.ai/api/automation/agents/10/gmail-auth-url \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Create AI workflow
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 10,
    "name": "AI Marketing Email",
    "triggerConfig": {"type": "manual"},
    "actions": [
      {
        "type": "generate_ai_content",
        "config": {
          "prompt": "Write a marketing email about {{product}}. Benefits: {{benefits}}. CTA: {{cta}}. Under 150 words.",
          "temperature": 0.7,
          "maxTokens": 300
        }
      },
      {
        "type": "send_email",
        "config": {
          "to": "{{recipient}}",
          "subject": "Discover {{product}}!",
          "body": "{{ai_content}}"
        }
      }
    ],
    "status": "active"
  }'

# 4. Send AI-powered email!
curl -X POST https://class.xytek.ai/api/automation/workflows/7/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "data": {
      "recipient": "customer@example.com",
      "product": "XYTEK AI Classroom",
      "benefits": "automated grading, 24/7 AI support, real-time insights",
      "cta": "Start your free trial today"
    }
  }'
```

---

## 📚 Related Documentation

- [Outbound Email Guide](./OUTBOUND_EMAIL_GUIDE.md)
- [AI Automation Guide](./AI_AUTOMATION_GUIDE.md)
- [User AI Setup Guide](./USER_AI_SETUP_GUIDE.md)

---

**Your outbound emails are now AI-powered!** 🎉🤖

