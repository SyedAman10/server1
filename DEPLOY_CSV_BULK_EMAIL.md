# 🚀 Deploy CSV Bulk Email Feature

Quick deployment guide for the new CSV bulk email functionality.

---

## 📦 What's Being Deployed

✅ **CSV Upload** - Upload recipient lists
✅ **Bulk Email Sending** - Send to hundreds/thousands
✅ **Personalization** - Variable replacement per recipient
✅ **Rate Limiting** - Avoid spam filters
✅ **Scheduling** - Send now or schedule
✅ **Progress Tracking** - Monitor success/failures

---

## 🔧 Deployment Steps

### **Step 1: Install Dependencies**

```bash
cd /home/ubuntu/server1
npm install multer csv-parse
```

These packages are needed for:
- `multer` - Handle CSV file uploads
- `csv-parse` - Parse CSV files

---

### **Step 2: Create Database Table**

```bash
node scripts/add-recipient-lists-table.js
```

**Expected output:**
```
🔧 Creating recipient_lists table...

✅ recipient_lists table created
✅ Indexes created

✅ Migration completed successfully!
```

---

### **Step 3: Pull Latest Code**

```bash
git pull
```

---

### **Step 4: Restart Server**

```bash
pm2 restart index
pm2 logs index --lines 20
```

---

### **Step 5: Verify Deployment**

Check that the server started successfully:

```bash
pm2 status
```

You should see `index` with status `online`.

---

## 🧪 Test the Feature

### **1. Activate Existing Agents**

```bash
node scripts/fix-inactive-agents.js
pm2 restart index
```

### **2. Create Test CSV**

Create `test-recipients.csv`:
```csv
email,name,company
your-email@gmail.com,Your Name,Test Company
```

### **3. Upload CSV**

```bash
curl -X POST https://class.xytek.ai/api/automation/recipient-lists/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "csv=@test-recipients.csv" \
  -F "name=Test List" \
  -F "description=Test bulk email"
```

**Save the `id` from the response!**

### **4. Create Bulk Email Workflow**

Replace `AGENT_ID` and `RECIPIENT_LIST_ID`:

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "agentId": AGENT_ID,
    "name": "Test Bulk Email",
    "triggerConfig": {"type": "manual"},
    "actions": [
      {
        "type": "send_bulk_email",
        "config": {
          "recipientListId": RECIPIENT_LIST_ID,
          "subject": "Test Email for {{name}}",
          "body": "Hi {{name}} from {{company}},\n\nThis is a test!\n\nBest regards",
          "delayBetweenEmails": 1000
        }
      }
    ],
    "status": "active"
  }'
```

### **5. Send Test**

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows/WORKFLOW_ID/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{}'
```

### **6. Check Email**

You should receive the personalized email within ~15 seconds!

---

## 📊 API Endpoints Added

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/automation/recipient-lists/upload` | Upload CSV |
| GET | `/api/automation/recipient-lists` | List all recipient lists |
| GET | `/api/automation/recipient-lists/:id` | Get specific list |
| DELETE | `/api/automation/recipient-lists/:id` | Delete list |

---

## 🎯 New Workflow Action

### **`send_bulk_email`**

Send personalized emails to all recipients in a CSV list.

**Config:**
```json
{
  "type": "send_bulk_email",
  "config": {
    "recipientListId": 5,
    "subject": "Hi {{name}}!",
    "body": "Email body with {{variables}}",
    "htmlBody": "<h1>HTML version</h1>",
    "delayBetweenEmails": 1000
  }
}
```

---

## ⚡ Features

### **1. Variable Replacement**
Any column in your CSV becomes a variable:

**CSV:**
```csv
email,name,plan,company
john@example.com,John,Premium,Acme Corp
```

**Template:**
```
Hi {{name}},

Your {{plan}} plan at {{company}} includes...
```

**Result:**
```
Hi John,

Your Premium plan at Acme Corp includes...
```

---

### **2. Send Now or Schedule**

**Send Now:**
```json
{
  "triggerConfig": {
    "type": "manual"
  }
}
```

**Schedule (Every Monday at 9 AM):**
```json
{
  "triggerConfig": {
    "type": "schedule",
    "schedule": {
      "frequency": "weekly",
      "dayOfWeek": "monday",
      "time": "09:00"
    }
  }
}
```

---

### **3. Rate Limiting**

Automatically adds delays between emails:

```json
{
  "delayBetweenEmails": 1000  // 1 second (default)
}
```

Gmail limits:
- Regular: 500 emails/day
- Workspace: 2,000 emails/day

---

### **4. Progress Tracking**

Returns detailed results:

```json
{
  "total": 250,
  "sent": 248,
  "failed": 2,
  "errors": [
    {
      "recipient": "invalid@email.com",
      "error": "Invalid email address"
    }
  ]
}
```

---

## 🆘 Troubleshooting

### **Migration Failed**

If the table creation fails:

```bash
# Check database connection
node scripts/test-db.js

# Try creating table manually
psql $DATABASE_URL
CREATE TABLE recipient_lists (...);
```

### **CSV Upload Returns 400**

- Ensure CSV has `email` column
- Check file size < 5MB
- Verify `Content-Type: multipart/form-data`

### **Emails Not Sending**

```bash
# Check agent status
node scripts/debug-polling.js

# Activate agents
node scripts/fix-inactive-agents.js

# Restart
pm2 restart index
```

### **"Module not found: multer"**

```bash
npm install multer csv-parse
pm2 restart index
```

---

## 📚 Documentation

Complete guides available:

- **`CSV_BULK_EMAIL_GUIDE.md`** - Full usage guide
- **`OUTBOUND_EMAIL_GUIDE.md`** - Outbound email basics
- **`AI_OUTBOUND_EMAIL_EXAMPLES.md`** - AI-powered examples

---

## ✅ Deployment Checklist

- [ ] Install dependencies (`multer`, `csv-parse`)
- [ ] Run database migration
- [ ] Pull latest code
- [ ] Restart server
- [ ] Test CSV upload
- [ ] Test bulk email sending
- [ ] Verify in production

---

**Your bulk email system is deployed!** 🎉📧

