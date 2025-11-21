# 📧 Bulk Email Feature Summary

Complete CSV upload and bulk email functionality has been added to your outbound agents!

---

## ✨ What You Can Do Now

### **1. Upload CSV Files**
- Upload recipient lists via API
- Support for unlimited custom fields
- Automatic parsing and validation

### **2. Send Personalized Bulk Emails**
- Send to hundreds/thousands of recipients
- Personalize each email with CSV data
- Variable replacement: `{{name}}`, `{{company}}`, etc.

### **3. Send Now or Schedule**
- **Manual**: Trigger bulk send immediately
- **Scheduled**: Weekly newsletter, daily digest, etc.

### **4. AI-Powered Bulk Emails**
- Combine AI content generation with bulk sending
- Generate personalized content for each recipient

---

## 🚀 Quick Start

### **1. Deploy**

```bash
cd /home/ubuntu/server1

# Install dependencies
npm install multer csv-parse

# Create database table
node scripts/add-recipient-lists-table.js

# Deploy
git pull
pm2 restart index
```

### **2. Create CSV**

Save as `recipients.csv`:
```csv
email,name,company,plan
john@example.com,John Doe,Acme Corp,Premium
jane@example.com,Jane Smith,Tech Inc,Basic
```

### **3. Upload CSV**

```bash
curl -X POST https://class.xytek.ai/api/automation/recipient-lists/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "csv=@recipients.csv" \
  -F "name=My Campaign" \
  -F "description=Q4 Marketing"
```

Returns: `{"recipientList": {"id": 5, ...}}`

### **4. Create Workflow**

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": 10,
    "name": "Marketing Campaign",
    "triggerConfig": {"type": "manual"},
    "actions": [
      {
        "type": "send_bulk_email",
        "config": {
          "recipientListId": 5,
          "subject": "Hi {{name}}!",
          "body": "Hi {{name}} from {{company}},\n\nYour {{plan}} plan...",
          "delayBetweenEmails": 1000
        }
      }
    ],
    "status": "active"
  }'
```

### **5. Send**

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/7/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{}'
```

---

## 📊 New Files Created

### **Models**
- `models/recipientList.model.js` - Database operations for recipient lists

### **Scripts**
- `scripts/add-recipient-lists-table.js` - Database migration
- `scripts/fix-inactive-agents.js` - Activate inactive agents

### **Documentation**
- `CSV_BULK_EMAIL_GUIDE.md` - Complete user guide
- `DEPLOY_CSV_BULK_EMAIL.md` - Deployment instructions
- `BULK_EMAIL_FEATURE_SUMMARY.md` - This file

### **Modified Files**
- `controllers/automation.controller.js` - Added CSV upload endpoints
- `routes/automation.routes.js` - Added recipient list routes
- `services/automation/automationExecutionEngine.js` - Added `send_bulk_email` action

---

## 🎯 Use Cases

### **1. Marketing Campaigns**
Upload customer list, send personalized offers.

### **2. Newsletters**
Schedule weekly/monthly newsletters to subscribers.

### **3. Event Invitations**
Send event details to attendees with custom fields.

### **4. Product Announcements**
Announce new features to users based on their plan.

### **5. Follow-ups**
Automated follow-up emails after webinars/demos.

---

## 📈 Features

| Feature | Status |
|---------|--------|
| CSV Upload | ✅ |
| Variable Replacement | ✅ |
| Send Now (Manual) | ✅ |
| Schedule Sending | ✅ |
| Rate Limiting | ✅ |
| Progress Tracking | ✅ |
| Error Handling | ✅ |
| AI Integration | ✅ |
| HTML Emails | ✅ |
| Personalization | ✅ |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `CSV_BULK_EMAIL_GUIDE.md` | Complete usage guide with examples |
| `DEPLOY_CSV_BULK_EMAIL.md` | Deployment instructions |
| `OUTBOUND_EMAIL_GUIDE.md` | General outbound email guide |
| `AI_OUTBOUND_EMAIL_EXAMPLES.md` | AI-powered email examples |

---

## 🔗 API Endpoints

### **Recipient Lists**
```
POST   /api/automation/recipient-lists/upload
GET    /api/automation/recipient-lists
GET    /api/automation/recipient-lists/:id
DELETE /api/automation/recipient-lists/:id
```

### **Workflows** (existing)
```
POST   /api/automation/workflows
POST   /api/automation/workflows/:id/execute
GET    /api/automation/workflows/:id
PUT    /api/automation/workflows/:id
DELETE /api/automation/workflows/:id
```

---

## ⚡ Example Workflow

### **Scheduled Weekly Newsletter**

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
      "type": "send_bulk_email",
      "config": {
        "recipientListId": 5,
        "subject": "Weekly Update for {{name}}",
        "htmlBody": "<h2>Hi {{name}},</h2><p>Here's what happened this week at {{company}}...</p>",
        "delayBetweenEmails": 1000
      }
    }
  ],
  "status": "active"
}
```

**This will automatically send every Monday at 9 AM to all recipients in list #5!**

---

## 💰 Cost Considerations

### **Token Usage (if using AI)**
- AI content generation: ~150-500 tokens per email
- Use GPT-3.5 for cost-effective bulk sends
- Use GPT-4 for high-quality, important emails

### **Gmail Limits**
- **Free Gmail**: 500 emails/day
- **Google Workspace**: 2,000 emails/day
- Recommendation: Add 1-2 second delay between emails

---

## ⚠️ Important Notes

### **Testing First**
Always test with a small CSV (3-5 recipients) before sending to your full list!

### **Rate Limiting**
Use `delayBetweenEmails: 1000` (1 second) minimum to avoid triggering spam filters.

### **Compliance**
- Get consent before sending
- Include unsubscribe link
- Follow GDPR/CAN-SPAM regulations

### **Email Quality**
- Test on multiple email clients
- Use both HTML and plain text
- Avoid spam trigger words

---

## 🎉 You're Ready!

1. **Deploy** the feature (see `DEPLOY_CSV_BULK_EMAIL.md`)
2. **Upload** your CSV recipient list
3. **Create** a bulk email workflow
4. **Send** or schedule your campaign!

**Full documentation in `CSV_BULK_EMAIL_GUIDE.md`** 📚

