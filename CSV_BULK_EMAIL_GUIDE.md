
# 📊 CSV Bulk Email Guide

Complete guide for uploading CSV files and sending bulk personalized emails.

---

## ✨ What's New

- ✅ **Upload CSV files** with recipient lists
- ✅ **Personalized emails** for each recipient
- ✅ **Send Now** (manual trigger)
- ✅ **Schedule** (automatic sending)
- ✅ **Variable replacement** ({{name}}, {{company}}, etc.)
- ✅ **Rate limiting** to avoid spam filters
- ✅ **Progress tracking** and error handling

---

## 📋 Table of Contents

1. [CSV Format](#csv-format)
2. [Upload CSV](#upload-csv)
3. [Create Bulk Email Workflow](#create-bulk-email-workflow)
4. [Send Now](#send-now)
5. [Schedule Sending](#schedule-sending)
6. [Examples](#examples)
7. [Best Practices](#best-practices)

---

## 📝 CSV Format

### **Required Columns**

Your CSV **MUST** have an `email` column (case-insensitive):

```csv
email,name,company,plan
john@example.com,John Doe,Acme Corp,Premium
jane@example.com,Jane Smith,Tech Inc,Basic
bob@example.com,Bob Johnson,StartUp Ltd,Enterprise
```

### **Optional Columns**

Add any custom fields you want to use for personalization:

- `name` - Recipient's name
- `company` - Company name
- `plan` - Subscription plan
- `custom_field_1` - Any custom data
- `custom_field_2` - More custom data
- ...any other fields you need!

### **Example CSV Files**

#### **Simple Newsletter**
```csv
email,name
user1@example.com,Alice
user2@example.com,Bob
user3@example.com,Charlie
```

#### **Marketing Campaign**
```csv
email,name,company,plan,trial_end_date
john@acme.com,John,Acme Corp,Premium,2025-12-31
jane@tech.com,Jane,Tech Inc,Basic,2025-11-30
```

#### **Event Invitation**
```csv
email,name,company,role,ticket_type
speaker1@example.com,Dr. Smith,MIT,Speaker,VIP
attendee1@example.com,John Doe,Google,Attendee,General
attendee2@example.com,Jane Doe,Apple,Attendee,General
```

---

## 📤 Upload CSV

### **Step 1: Prepare Your CSV**

Create a CSV file with your recipients. Save it as `recipients.csv`.

### **Step 2: Upload via API**

```bash
curl -X POST https://class.xytek.ai/api/automation/recipient-lists/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "csv=@recipients.csv" \
  -F "name=My Campaign Recipients" \
  -F "description=Marketing campaign for Q4 2025"
```

**Response:**
```json
{
  "success": true,
  "recipientList": {
    "id": 5,
    "name": "My Campaign Recipients",
    "description": "Marketing campaign for Q4 2025",
    "totalCount": 250,
    "createdAt": "2025-11-21T10:00:00Z"
  },
  "sample": [
    {
      "email": "john@example.com",
      "name": "John Doe",
      "company": "Acme Corp"
    },
    {
      "email": "jane@example.com",
      "name": "Jane Smith",
      "company": "Tech Inc"
    },
    {
      "email": "bob@example.com",
      "name": "Bob Johnson",
      "company": "StartUp Ltd"
    }
  ]
}
```

**Save the `id` (5 in this example) - you'll need it for the workflow!**

---

## 🚀 Create Bulk Email Workflow

### **Option 1: Send Now (Manual Trigger)**

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 10,
    "name": "Marketing Campaign",
    "description": "Send personalized marketing emails",
    "triggerConfig": {
      "type": "manual"
    },
    "actions": [
      {
        "type": "send_bulk_email",
        "config": {
          "recipientListId": 5,
          "subject": "Hi {{name}}, Check out our new features!",
          "body": "Hi {{name}},\n\nWe noticed you'\''re on the {{plan}} plan at {{company}}.\n\nWe'\''ve just launched amazing new features perfect for you!\n\nBest regards,\nXYTEK Team",
          "htmlBody": "<h2>Hi {{name}},</h2><p>We noticed you'\''re on the <strong>{{plan}}</strong> plan at {{company}}.</p><p>We'\''ve just launched amazing new features perfect for you!</p><p>Best regards,<br>XYTEK Team</p>",
          "delayBetweenEmails": 1000
        }
      }
    ],
    "status": "active"
  }'
```

**Send it now:**
```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/7/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{}'
```

---

### **Option 2: Schedule Sending**

Send every Monday at 9 AM:

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 10,
    "name": "Weekly Newsletter",
    "description": "Send newsletter every Monday",
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
        "type": "send_bulk_email",
        "config": {
          "recipientListId": 5,
          "subject": "Weekly Update for {{name}}",
          "body": "Hi {{name}},\n\nHere'\''s your weekly update...\n\nBest regards,\nXYTEK Team",
          "delayBetweenEmails": 1000
        }
      }
    ],
    "status": "active"
  }'
```

**This will automatically send every Monday at 9 AM!**

---

## 💡 Examples

### **Example 1: Simple Newsletter**

**CSV:**
```csv
email,name
alice@example.com,Alice
bob@example.com,Bob
charlie@example.com,Charlie
```

**Workflow:**
```json
{
  "type": "send_bulk_email",
  "config": {
    "recipientListId": 5,
    "subject": "Newsletter - {{date}}",
    "body": "Hi {{name}},\n\nHere's this week's update...",
    "delayBetweenEmails": 1000
  }
}
```

---

### **Example 2: Personalized Marketing Campaign**

**CSV:**
```csv
email,name,company,plan,feature
john@acme.com,John,Acme Corp,Premium,Advanced Analytics
jane@tech.com,Jane,Tech Inc,Basic,Team Collaboration
```

**Workflow:**
```json
{
  "type": "send_bulk_email",
  "config": {
    "recipientListId": 6,
    "subject": "{{name}}, unlock {{feature}} for {{company}}",
    "htmlBody": "<h2>Hi {{name}},</h2><p>As a <strong>{{plan}}</strong> customer at {{company}}, you now have access to <strong>{{feature}}</strong>!</p><p><a href='https://xytek.ai/features'>Learn More</a></p>",
    "delayBetweenEmails": 1500
  }
}
```

---

### **Example 3: Event Reminders**

**CSV:**
```csv
email,name,event_name,event_date,ticket_type
speaker@example.com,Dr. Smith,AI Conference,Dec 1 2025,VIP
attendee1@example.com,John,AI Conference,Dec 1 2025,General
```

**Workflow:**
```json
{
  "type": "send_bulk_email",
  "config": {
    "recipientListId": 7,
    "subject": "Reminder: {{event_name}} on {{event_date}}",
    "body": "Hi {{name}},\n\nThis is a reminder about {{event_name}} on {{event_date}}.\n\nYour ticket type: {{ticket_type}}\n\nSee you there!\nXYTEK Events",
    "delayBetweenEmails": 1000
  }
}
```

---

### **Example 4: AI-Generated + Bulk Send**

Combine AI content generation with bulk sending:

```json
{
  "actions": [
    {
      "type": "generate_ai_content",
      "config": {
        "prompt": "Write a friendly email about our new {{product_name}} feature. Keep it under 100 words."
      }
    },
    {
      "type": "send_bulk_email",
      "config": {
        "recipientListId": 8,
        "subject": "New Feature: {{product_name}}",
        "body": "Hi {{name}},\n\n{{ai_content}}\n\nBest regards,\nXYTEK Team",
        "delayBetweenEmails": 1000
      }
    }
  ]
}
```

**Trigger with:**
```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/9/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "data": {
      "product_name": "Smart Reply Assistant"
    }
  }'
```

---

## 🎯 Manage Recipient Lists

### **View All Lists**

```bash
curl -X GET https://class.xytek.ai/api/automation/recipient-lists \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **View Specific List**

```bash
curl -X GET https://class.xytek.ai/api/automation/recipient-lists/5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Delete List**

```bash
curl -X DELETE https://class.xytek.ai/api/automation/recipient-lists/5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚙️ Configuration Options

### **Delay Between Emails**

Add delay to avoid rate limiting:

```json
{
  "delayBetweenEmails": 1000  // 1 second (default)
  "delayBetweenEmails": 2000  // 2 seconds (safer)
  "delayBetweenEmails": 5000  // 5 seconds (very safe)
}
```

### **Subject Line**

Use variables for personalization:

```json
{
  "subject": "Hi {{name}}!"
  "subject": "Update for {{company}}"
  "subject": "{{name}}, your {{plan}} plan is expiring"
}
```

### **Email Body**

Plain text or HTML:

```json
{
  "body": "Plain text email with {{variables}}",
  "htmlBody": "<h1>HTML email</h1><p>With {{variables}}</p>"
}
```

---

## 📊 Monitoring

### **Check Execution Results**

```bash
curl -X GET https://class.xytek.ai/api/automation/agents/10/executions \
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
      "result": {
        "total": 250,
        "sent": 248,
        "failed": 2,
        "errors": [
          {
            "recipient": "invalid@email",
            "error": "Invalid email address"
          }
        ]
      },
      "created_at": "2025-11-21T10:00:00Z"
    }
  ]
}
```

### **View Logs**

```bash
pm2 logs index | grep "Bulk email"
```

Expected output:
```
📤 Sending bulk email to 250 recipients...
   ✅ Sent to john@example.com (1/250)
   ✅ Sent to jane@example.com (2/250)
   ...
✅ Bulk email completed: 248 sent, 2 failed
```

---

## ⚠️ Best Practices

### **1. Test First**
✅ Upload a small test CSV (3-5 recipients)
✅ Send to yourself first
✅ Review email formatting

### **2. Rate Limiting**
✅ Use `delayBetweenEmails: 1000` minimum
✅ Gmail limit: ~500 emails/day (regular), ~2000/day (Workspace)
✅ Consider splitting large lists across multiple days

### **3. Personalization**
✅ Always use `{{name}}` for personal touch
✅ Include relevant custom fields
✅ Test variable replacement

### **4. Email Quality**
✅ Include unsubscribe link for newsletters
✅ Use both plain text and HTML
✅ Test on multiple email clients
✅ Avoid spam trigger words

### **5. Compliance**
✅ Get consent before sending
✅ Honor unsubscribe requests
✅ Follow GDPR/CAN-SPAM regulations
✅ Keep records of consent

### **6. Error Handling**
✅ Review failed sends
✅ Remove bounced emails
✅ Monitor spam complaints

---

## 🚨 Rate Limits

| Provider | Free/Regular | Workspace/Paid |
|----------|--------------|----------------|
| **Gmail** | 500/day | 2,000/day |
| **Outlook** | 300/day | 10,000/day |
| **SendGrid** | 100/day | Unlimited* |

**Gmail recommendations:**
- Max 1 email/second
- Max 500 recipients/message
- Use delays to stay under limits

---

## 🔄 Schedule Options

### **Daily**
```json
{
  "frequency": "daily",
  "time": "09:00"
}
```

### **Weekly**
```json
{
  "frequency": "weekly",
  "dayOfWeek": "monday",
  "time": "09:00"
}
```

### **Monthly**
```json
{
  "frequency": "monthly",
  "dayOfMonth": 1,
  "time": "09:00"
}
```

---

## 🛠️ Deployment

```bash
# 1. Create database table
node scripts/add-recipient-lists-table.js

# 2. Install dependencies
npm install multer csv-parse

# 3. Deploy
cd /home/ubuntu/server1
git pull
pm2 restart index
pm2 logs index --lines 20
```

---

## 🆘 Troubleshooting

### **CSV Upload Fails**
- Check CSV has `email` column
- Verify file size < 5MB
- Ensure UTF-8 encoding

### **Emails Not Sending**
- Check agent is active
- Verify Gmail is connected
- Check rate limits

### **Variables Not Replacing**
- Ensure column names match variables
- Check spelling: `{{name}}` matches `name` column
- Case-sensitive matching

### **Slow Sending**
- Increase `delayBetweenEmails`
- Split into smaller batches
- Check Gmail quota

---

## 📚 Related Documentation

- [Outbound Email Guide](./OUTBOUND_EMAIL_GUIDE.md)
- [AI Outbound Examples](./AI_OUTBOUND_EMAIL_EXAMPLES.md)
- [Automation System Guide](./AUTOMATION_SYSTEM_GUIDE.md)

---

## ✅ Quick Start Checklist

- [ ] Create outbound email agent
- [ ] Connect Gmail
- [ ] Prepare CSV file with `email` column
- [ ] Upload CSV
- [ ] Create bulk email workflow
- [ ] Test with small list first
- [ ] Send to full list or schedule
- [ ] Monitor execution results

---

**Your bulk email system is ready!** 📧✨

