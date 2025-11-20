# 🔐 Gmail Automation OAuth Setup

## ✅ Changes Made

The Gmail automation system now **reuses the existing Google OAuth setup** from your Classroom integration instead of creating a separate one.

### What Changed:

1. **Shared OAuth Client**: Uses the same `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `REDIRECT_URI` from `.env`
2. **Shared Callback**: Uses `/api/auth/google/callback` (same as Classroom)
3. **Added Gmail Scopes**: 
   - `gmail.readonly` - Read emails
   - `gmail.modify` - Mark as read, add labels
   - `gmail.send` - Already existed for Classroom

4. **State Parameter Differentiation**:
   - Classroom: `state = "teacher"` or `"student"` or `"super_admin"`
   - Automation: `state = {"type":"automation","userId":123,"agentId":1}`

---

## 🚀 How to Use

### Step 1: Create Email Agent

```bash
curl -X POST https://class.xytek.ai/api/automation/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Support Email Bot",
    "description": "Auto-responds to support emails",
    "type": "email_inbound",
    "config": {
      "pollingInterval": 60
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": 1,
    ...
  }
}
```

**Save the agent `id`** (e.g., `1`)

---

### Step 2: Get Gmail OAuth URL

```bash
curl -X GET https://class.xytek.ai/api/automation/agents/1/gmail/auth \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&state=%7B%22type%22%3A%22automation%22%2C%22userId%22%3A4%2C%22agentId%22%3A1%7D"
}
```

---

### Step 3: Authorize Gmail

**Open the `authUrl` in your browser:**

1. Sign in to Gmail
2. Grant permissions:
   - ✅ Read your email messages
   - ✅ Send email on your behalf
   - ✅ Modify your email (mark as read, labels)
3. Google redirects to: `https://class.xytek.ai/api/auth/google/callback?code=...&state=...`
4. Callback handler detects `state.type = "automation"` and saves tokens to `email_agent_configs` table
5. You're redirected to: `https://your-frontend.com/automation?success=true&agentId=1`

---

### Step 4: Verify Connection

**Check the database:**
```bash
psql $DATABASE_URL -c "SELECT agent_id, email_address, provider FROM email_agent_configs;"
```

**Or via API:**
```bash
curl -X GET https://class.xytek.ai/api/automation/agents/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected response includes:**
```json
{
  "success": true,
  "agent": {
    "id": 1,
    "name": "Support Email Bot",
    "type": "email_inbound",
    "status": "inactive",
    "emailConfig": {
      "email_address": "your-gmail@gmail.com",
      "provider": "gmail",
      "polling_interval": 60
    }
  }
}
```

---

### Step 5: Create Workflow

```bash
curl -X POST https://class.xytek.ai/api/automation/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "agentId": 1,
    "name": "Auto-Reply Workflow",
    "triggerConfig": {
      "type": "email_received",
      "filters": {
        "from": ".*"
      }
    },
    "actions": [
      {
        "type": "reply_to_email",
        "config": {
          "replyBody": "Thank you for your email! We will respond within 24 hours."
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

### Step 6: Activate Agent

```bash
curl -X PATCH https://class.xytek.ai/api/automation/agents/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"status": "active"}'
```

---

### Step 7: Test!

1. **Send an email** to the Gmail account you connected
2. **Wait 60 seconds** (polling interval)
3. **Check PM2 logs:**

```bash
pm2 logs index | grep "📧"
```

**Expected output:**
```
📧 Polling email agents...
   Found 1 email agent(s) to poll
   📬 Polling Support Email Bot (your-gmail@gmail.com)
      Found 1 new email(s)
      📨 Processing email: Test Subject
         🔔 Triggering workflow: Auto-Reply Workflow
✅ Email polling completed
```

4. **You should receive an auto-reply!** 🎉

---

## 📋 Environment Variables

Make sure these are set in your `.env`:

```env
# Google OAuth (Shared by Classroom & Automation)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
REDIRECT_URI=https://class.xytek.ai/api/auth/google/callback

# Database
DATABASE_URL=your-database-url

# JWT
JWT_SECRET=your-jwt-secret
```

---

## 🔧 Deployment

```bash
# On your server
cd /home/ubuntu/server1

# Pull latest code
git pull

# Restart PM2
pm2 restart index

# Check logs
pm2 logs index --lines 50
```

---

## 🔍 Troubleshooting

### Issue: "No email agents to poll"

**Cause:** Email config not created (Gmail not authorized)

**Fix:** Complete the Gmail OAuth flow (Steps 2-3 above)

---

### Issue: "Invalid grant" error during OAuth

**Cause:** Authorization code expired or already used

**Fix:** Get a new auth URL and try again

---

### Issue: OAuth callback shows "Invalid role"

**Cause:** State parameter is malformed

**Fix:** Make sure you're using the auth URL from `/api/automation/agents/:agentId/gmail/auth` endpoint

---

### Issue: Agent not polling

**Check agent status:**
```bash
curl -X GET https://class.xytek.ai/api/automation/agents/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Should show:**
```json
{
  "status": "active",
  "emailConfig": { ... }
}
```

If `status` is `inactive`, activate it:
```bash
curl -X PATCH https://class.xytek.ai/api/automation/agents/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "active"}'
```

---

## 📊 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. User clicks "Connect Gmail" in frontend                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. GET /api/automation/agents/1/gmail/auth                 │
│     Returns OAuth URL with state={type:automation,userId,  │
│     agentId}                                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. User authorizes on Google's page                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Google redirects to /api/auth/google/callback           │
│     with code + state                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Callback checks state.type                              │
│     - If "automation": Call automation.handleGmailCallback  │
│     - If role string: Regular classroom OAuth               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Save tokens to email_agent_configs table                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Email polling service picks up agent                    │
│     Every 60 seconds, checks for new emails                 │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Benefits of Shared OAuth

1. **Single Configuration**: One set of credentials in `.env`
2. **Single Callback URL**: No need to configure multiple URLs in Google Cloud Console
3. **All Scopes in One Place**: Gmail scopes added to existing classroom scopes
4. **Consistent Auth Flow**: Same pattern for all Google services

---

**Created by:** XYTEK Development Team  
**Last Updated:** November 20, 2025  
**Status:** ✅ Ready to use - OAuth unified

