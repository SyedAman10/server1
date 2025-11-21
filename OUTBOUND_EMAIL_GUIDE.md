# 📤 Outbound Email Agent Guide

Complete guide for creating and using outbound email agents for automated email sending.

---

## 📋 Table of Contents

1. [What is an Outbound Email Agent?](#what-is-an-outbound-email-agent)
2. [Use Cases](#use-cases)
3. [Setup Process](#setup-process)
4. [Workflow Examples](#workflow-examples)
5. [API Reference](#api-reference)

---

## 🎯 What is an Outbound Email Agent?

An **outbound email agent** sends emails automatically based on triggers:

| Feature | Inbound Agent | Outbound Agent |
|---------|---------------|----------------|
| **Purpose** | Receives & replies to emails | Sends emails automatically |
| **Trigger** | New email received | Schedule, event, or manual |
| **Use Case** | Auto-reply, support | Newsletters, reports, campaigns |

---

## 💡 Use Cases

### 1. **Scheduled Newsletters**
- Send weekly updates to subscribers
- Daily digest emails
- Monthly reports

### 2. **Event-Triggered Emails**
- Welcome emails for new users
- Order confirmations
- Reminder emails

### 3. **Bulk Campaigns**
- Marketing emails
- Announcements
- Product updates

### 4. **Automated Follow-ups**
- Follow up after meetings
- Post-purchase emails
- Re-engagement campaigns

---

## 🚀 Setup Process

### **Step 1: Create Outbound Email Agent**

```bash
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Newsletter Agent",
    "description": "Sends weekly newsletters to subscribers",
    "type": "email_outbound",
    "config": {
      "provider": "gmail",
      "fromName": "XYTEK Newsletter",
      "replyTo": "hello@xytek.ai"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": 10,
    "name": "Newsletter Agent",
    "type": "email_outbound",
    "status": "active"
  }
}
```

---

### **Step 2: Connect Gmail Account**

Get the authorization URL:

```bash
curl -X GET https://class.xytek.ai/api/automation/agents/10/gmail-auth-url \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

**Visit the URL** in your browser and authorize Gmail access. You'll be redirected back after authorization.

---

### **Step 3: Verify Gmail Connection**

```bash
curl -X GET https://class.xytek.ai/api/automation/agents/10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": 10,
    "name": "Newsletter Agent",
    "isGmailConnected": true,
    "connectedEmail": "your-email@gmail.com"
  }
}
```

---

### **Step 4: Create Outbound Workflow**

Choose your trigger type:

#### **A. Schedule-Based Trigger**

Send emails on a schedule (e.g., every Monday at 9 AM):

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 10,
    "name": "Weekly Newsletter",
    "description": "Send newsletter every Monday at 9 AM",
    "triggerConfig": {
      "type": "schedule",
      "schedule": {
        "frequency": "weekly",
        "dayOfWeek": "monday",
        "time": "09:00"
      }
    },
    "actions": [
      {
        "type": "send_email",
        "config": {
          "to": ["subscriber1@example.com", "subscriber2@example.com"],
          "subject": "Weekly Newsletter - {{date}}",
          "body": "Hello!\n\nHere is your weekly update...\n\nBest regards,\nXYTEK Team",
          "htmlBody": "<h2>Weekly Newsletter</h2><p>Here is your weekly update...</p>"
        }
      }
    ],
    "status": "active"
  }'
```

#### **B. Manual Trigger**

Send emails on-demand via API:

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 10,
    "name": "Manual Campaign",
    "description": "Send emails when triggered manually",
    "triggerConfig": {
      "type": "manual"
    },
    "actions": [
      {
        "type": "send_email",
        "config": {
          "to": "{{recipient}}",
          "subject": "{{subject}}",
          "body": "{{body}}",
          "htmlBody": "{{htmlBody}}"
        }
      }
    ],
    "status": "active"
  }'
```

#### **C. Event-Based Trigger** (Coming Soon)

Send emails when something happens in your system:

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 10,
    "name": "Welcome Email",
    "description": "Send welcome email when user signs up",
    "triggerConfig": {
      "type": "event",
      "event": "user.created"
    },
    "actions": [
      {
        "type": "send_email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Welcome to XYTEK!",
          "body": "Hi {{user.name}},\n\nWelcome aboard!\n\nBest regards,\nXYTEK Team"
        }
      }
    ],
    "status": "active"
  }'
```

---

## 📝 Workflow Examples

### **Example 1: Simple Newsletter**

```json
{
  "agentId": 10,
  "name": "Weekly Newsletter",
  "triggerConfig": {
    "type": "schedule",
    "schedule": {
      "frequency": "weekly",
      "dayOfWeek": "monday",
      "time": "09:00"
    }
  },
  "actions": [
    {
      "type": "send_email",
      "config": {
        "to": ["user1@example.com", "user2@example.com"],
        "subject": "This Week at XYTEK",
        "htmlBody": "<h1>Weekly Update</h1><p>Here's what happened this week...</p>"
      }
    }
  ]
}
```

---

### **Example 2: Daily Report with AI**

Generate a daily report using AI:

```json
{
  "agentId": 10,
  "name": "Daily AI Report",
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
        "prompt": "Generate a brief daily summary of key metrics and insights for our team. Keep it under 100 words.",
        "temperature": 0.7
      }
    },
    {
      "type": "send_email",
      "config": {
        "to": ["team@xytek.ai"],
        "subject": "Daily Report - {{date}}",
        "body": "{{ai_content}}"
      }
    }
  ]
}
```

---

### **Example 3: Bulk Campaign with Personalization**

Send personalized emails to multiple recipients:

```json
{
  "agentId": 10,
  "name": "Product Launch Campaign",
  "triggerConfig": {
    "type": "manual"
  },
  "actions": [
    {
      "type": "send_bulk_email",
      "config": {
        "recipients": [
          {
            "email": "john@example.com",
            "name": "John",
            "custom_field": "Premium Plan"
          },
          {
            "email": "jane@example.com",
            "name": "Jane",
            "custom_field": "Basic Plan"
          }
        ],
        "subject": "New Features Just for You!",
        "htmlBody": "<p>Hi {{name}},</p><p>As a {{custom_field}} user, you'll love these new features...</p>"
      }
    }
  ]
}
```

---

## 🔧 API Reference

### **Trigger a Manual Workflow**

Execute a manual workflow immediately:

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/5/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "data": {
      "recipient": "user@example.com",
      "subject": "Hello!",
      "body": "This is a test email."
    }
  }'
```

---

### **Get Workflow Executions**

See execution history:

```bash
curl -X GET https://class.xytek.ai/api/automation/workflows/5/executions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "executions": [
    {
      "id": 123,
      "status": "completed",
      "created_at": "2025-11-21T10:00:00Z",
      "result": {
        "emailsSent": 1,
        "recipients": ["user@example.com"]
      }
    }
  ]
}
```

---

## 📊 Monitoring & Logs

### **Check Execution Status**

```bash
curl -X GET https://class.xytek.ai/api/automation/executions/123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **View Logs**

```bash
pm2 logs index | grep "Outbound"
```

Expected output:
```
📤 Executing outbound workflow: Weekly Newsletter
📧 Sending email to: user1@example.com
✅ Email sent successfully
```

---

## ⚠️ Important Notes

### **Email Limits**
- Gmail: ~500 emails/day for regular accounts
- Gmail: ~2000 emails/day for Google Workspace
- Consider using dedicated email services (SendGrid, Mailgun) for high volume

### **Best Practices**
1. **Always include unsubscribe link** for newsletters
2. **Test with small groups** before bulk sending
3. **Use proper email templates** (HTML + plain text)
4. **Monitor bounce rates** and remove invalid emails
5. **Respect user preferences** and GDPR/CAN-SPAM regulations

### **Rate Limiting**
- Add delays between emails to avoid triggering spam filters
- Use `delay` action between sends in bulk campaigns

---

## 🎯 Quick Start Checklist

- [ ] Create outbound email agent
- [ ] Connect Gmail account
- [ ] Verify Gmail connection
- [ ] Create workflow with trigger
- [ ] Test with a small recipient list
- [ ] Monitor execution logs
- [ ] Scale to full recipient list

---

## 🆘 Troubleshooting

### **Emails Not Sending**
1. Check agent status: `status = 'active'`
2. Verify Gmail connection: `isGmailConnected = true`
3. Check workflow status: `status = 'active'`
4. Review execution logs for errors

### **Emails Going to Spam**
1. Use a verified domain for sending
2. Include proper HTML structure
3. Add unsubscribe link
4. Warm up your sending domain gradually
5. Monitor bounce/complaint rates

### **OAuth Token Expired**
Re-authorize Gmail:
```bash
curl https://class.xytek.ai/api/automation/agents/10/gmail-auth-url \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🚀 Advanced Features (Coming Soon)

- **Email Templates**: Reusable HTML templates
- **A/B Testing**: Test subject lines and content
- **Analytics**: Open rates, click rates, conversions
- **Dynamic Recipients**: Load from database or API
- **Scheduling Calendar**: Visual schedule editor
- **Email Sequences**: Multi-step drip campaigns

---

## 📚 Related Docs

- [Inbound Email Agent Guide](./AUTOMATION_QUICKSTART.md)
- [AI Integration Guide](./AI_AUTOMATION_GUIDE.md)
- [Gmail OAuth Setup](./GMAIL_AUTOMATION_OAUTH_GUIDE.md)

---

**Need help?** Check the logs or run diagnostics:
```bash
node scripts/debug-polling.js
```

