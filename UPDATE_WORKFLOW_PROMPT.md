# Fix AI Reply Format

## Problem
The AI is sending replies with placeholder text like:
- `[Your Name]`
- `[Your Position]`
- `[Your Contact Information]`

## Solution
Update your workflow with a better system prompt.

---

## Step 1: Get Your Workflow ID

```bash
curl https://class.xytek.ai/api/automation/agents/3/workflows \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJyaW1hbGFiYmFzMjAwMEBnbWFpbC5jb20iLCJuYW1lIjoiU3llZCBBbWFuIFVsbGFoIE5hcXZpIiwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjM2NTQxOTQsImV4cCI6MTc2NDI1ODk5NH0.C9M8OMqqQmIvGetcJtAeUF8fSedtffM2g5WjcZLyytk"
```

Look for the workflow ID (probably 4).

---

## Step 2: Update Workflow with Better Prompt

### Option A: Professional Support Agent

```bash
curl -X PUT https://class.xytek.ai/api/automation/workflows/4 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJyaW1hbGFiYmFzMjAwMEBnbWFpbC5jb20iLCJuYW1lIjoiU3llZCBBbWFuIFVsbGFoIE5hcXZpIiwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjM2NTQxOTQsImV4cCI6MTc2NDI1ODk5NH0.C9M8OMqqQmIvGetcJtAeUF8fSedtffM2g5WjcZLyytk" \
  -d '{
    "actions": [
      {
        "type": "generate_ai_reply",
        "config": {
          "systemPrompt": "You are a friendly and helpful assistant. Respond naturally to the email. Keep responses under 100 words. Be conversational and warm. Sign off with \"Best regards\" only. DO NOT use any placeholder text like [Your Name] or [Your Position]. Write complete, ready-to-send responses.",
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

### Option B: Customer Support

```bash
curl -X PUT https://class.xytek.ai/api/automation/workflows/4 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJyaW1hbGFiYmFzMjAwMEBnbWFpbC5jb20iLCJuYW1lIjoiU3llZCBBbWFuIFVsbGFoIE5hcXZpIiwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjM2NTQxOTQsImV4cCI6MTc2NDI1ODk5NH0.C9M8OMqqQmIvGetcJtAeUF8fSedtffM2g5WjcZLyytk" \
  -d '{
    "actions": [
      {
        "type": "generate_ai_reply",
        "config": {
          "systemPrompt": "You are a customer support agent. Be helpful and professional. Keep responses brief (under 80 words). DO NOT use placeholder text - write complete, natural responses. Sign off with just \"Best regards, Support Team\".",
          "temperature": 0.7,
          "maxTokens": 250
        }
      },
      {
        "type": "mark_as_read"
      }
    ]
  }'
```

### Option C: Super Simple & Friendly

```bash
curl -X PUT https://class.xytek.ai/api/automation/workflows/4 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJyaW1hbGFiYmFzMjAwMEBnbWFpbC5jb20iLCJuYW1lIjoiU3llZCBBbWFuIFVsbGFoIE5hcXZpIiwicm9sZSI6InRlYWNoZXIiLCJpYXQiOjE3NjM2NTQxOTQsImV4cCI6MTc2NDI1ODk5NH0.C9M8OMqqQmIvGetcJtAeUF8fSedtffM2g5WjcZLyytk" \
  -d '{
    "actions": [
      {
        "type": "generate_ai_reply",
        "config": {
          "systemPrompt": "You are a friendly assistant named Aman. Reply to emails naturally and helpfully. Keep it brief (2-3 sentences max). Be warm and conversational. Just sign off with \"Cheers!\" - no other signature needed. Never use placeholder text like [Name] or [Position].",
          "temperature": 0.8,
          "maxTokens": 150
        }
      },
      {
        "type": "mark_as_read"
      }
    ]
  }'
```

---

## Step 3: Test Again

Send another test email to: **amanullahnaqvi@gmail.com**

```
Subject: Quick question
Body: Hey, can you help me understand how this works?
```

---

## Expected Results

### Before (Bad):
```
Dear Aman,

Thank you for reaching out...

Best regards,
[Your Name]
[Your Position]
[Your Contact Information]
```

### After Option A (Professional):
```
Hi there!

Thank you for your email. I'd be happy to help you understand how our 
system works. Could you let me know which specific aspect you're curious 
about? I'm here to assist!

Best regards
```

### After Option C (Friendly):
```
Hey! I'd be happy to explain how it works. What specifically would 
you like to know? Just shoot me your questions and I'll walk you through it.

Cheers!
```

---

## Why This Happened

The AI was likely using a default/empty prompt or a bad prompt that made it generate template-style emails. The key fixes:

1. ✅ **"DO NOT use placeholder text"** - Explicitly tells AI not to use `[brackets]`
2. ✅ **"Write complete responses"** - Makes AI fill in all details
3. ✅ **Lower max tokens** - Forces shorter, more direct responses
4. ✅ **Specific sign-off** - Tells AI exactly how to end the email

---

## Custom Your Own Prompt

You can create any style you want:

```bash
curl -X PUT https://class.xytek.ai/api/automation/workflows/4 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "actions": [
      {
        "type": "generate_ai_reply",
        "config": {
          "systemPrompt": "YOUR CUSTOM INSTRUCTIONS HERE",
          "temperature": 0.7,
          "maxTokens": 200
        }
      },
      {
        "type": "mark_as_read"
      }
    ]
  }'
```

**Tips for writing good prompts:**
- Be specific about tone (friendly, professional, casual)
- Set length limits ("under 50 words", "2-3 sentences")
- Tell it what NOT to do ("Don't use placeholder text")
- Specify exact sign-off format
- Give it a persona if needed ("You are a support agent named Sarah")

---

Pick one of the options above and run it! 🚀

