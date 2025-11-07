# Quick Start: Custom Xytek Classroom Invitations

## 🚀 TL;DR

```bash
# Invite a student WITH custom Xytek email:
POST /api/classroom/:courseId/invite
{
  "email": "student@example.com",
  "role": "STUDENT",
  "sendCustomEmail": true  // <-- Add this!
}

# Invite a student WITHOUT custom email:
POST /api/classroom/:courseId/invite
{
  "email": "student@example.com",
  "role": "STUDENT"
  // sendCustomEmail defaults to false
}
```

---

## 📚 Complete API Reference

### **1. Invite Single Student**

```javascript
const axios = require('axios');

await axios.post(
  'http://localhost:3000/api/classroom/123456/invite',
  {
    email: 'student@example.com',
    role: 'STUDENT',
    sendCustomEmail: true  // Optional, defaults to false
  },
  {
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN'
    }
  }
);
```

**Response:**
```json
{
  "invitation": {
    "id": "invitation_id",
    "courseId": "123456",
    "userId": "student@example.com",
    "role": "STUDENT"
  },
  "customEmailSent": true,
  "note": "Google Classroom automatically sent its own invitation email. This cannot be disabled via API."
}
```

---

### **2. Invite Multiple Teachers**

```javascript
await axios.post(
  'http://localhost:3000/api/classroom/123456/invite-teachers',
  {
    emails: [
      'teacher1@example.com',
      'teacher2@example.com'
    ],
    sendCustomEmail: true  // Optional, defaults to false
  },
  {
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN'
    }
  }
);
```

**Response:**
```json
{
  "message": "Successfully invited 2 teachers",
  "invitations": [ ... ],
  "customEmailsSent": [
    { "email": "teacher1@example.com", "success": true, "messageId": "..." },
    { "email": "teacher2@example.com", "success": true, "messageId": "..." }
  ],
  "note": "Google Classroom automatically sent its own invitation emails. This cannot be disabled via API."
}
```

---

## 🎨 Email Preview

Your custom Xytek email will look like this:

```
┌──────────────────────────────────────────────┐
│                                              │
│  ╔═══════════════════════════════════════╗  │
│  ║    🎓 Welcome to Xytek!               ║  │
│  ║  [Purple Gradient Background]         ║  │
│  ╚═══════════════════════════════════════╝  │
│                                              │
│  Hello!                                      │
│                                              │
│  [Teacher Name] has invited you to join:    │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ 📚 Introduction to Computer Science    │ │
│  │ 📖 Section: Spring 2025                │ │
│  │ 👨‍🏫 Teacher: Prof. Johnson            │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  To get started:                             │
│  1. Click the button below                   │
│  2. Complete your profile                    │
│  3. Start learning!                          │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │   [ Access Your Classroom → ]          │ │
│  │      [Purple Button]                    │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Need help? Reply to this email             │
│                                              │
│  Best regards,                               │
│  The Xytek Team                             │
│                                              │
└──────────────────────────────────────────────┘
```

---

## ⚙️ Configuration

### **No Additional Setup Required!**

The feature works out of the box if you have:
- ✅ Google OAuth2 configured
- ✅ Gmail API enabled in your Google Cloud Console
- ✅ `https://www.googleapis.com/auth/gmail.send` scope

### **Check Your Scopes:**

```javascript
// In integrations/google.classroom.js
// Make sure this scope is included:
'https://www.googleapis.com/auth/gmail.send'
```

---

## 📝 Testing

### **1. Run the Test Script:**

```bash
# Edit test-custom-invite.js with your values
node test-custom-invite.js
```

### **2. Manual Test via cURL:**

```bash
curl -X POST http://localhost:3000/api/classroom/123456/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "student@example.com",
    "role": "STUDENT",
    "sendCustomEmail": true
  }'
```

### **3. Expected Result:**

✅ Student receives Google Classroom email (automatic)  
✅ Student receives Xytek branded email (your custom one)  
✅ Both emails arrive within seconds

---

## 🔧 Customization

### **Change Email Colors:**

Edit `services/emailService.js`:

```javascript
// Line ~203
.header { 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
  // Change to your brand colors ↑
}
```

### **Change Button Color:**

```javascript
// Line ~207
.cta-button { 
  background: #667eea; // Your brand color
}
```

### **Add Your Logo:**

```javascript
// In the <div class="header"> section
<div class="header">
  <img src="https://yoursite.com/logo.png" alt="Xytek" style="height: 50px; margin-bottom: 10px;">
  <h1>Welcome to Xytek!</h1>
</div>
```

---

## 🚨 Important Notes

### **Google's Email Cannot Be Prevented**

When you invite a student via the API, Google Classroom **will always send an email**. This is a limitation of the Google Classroom API, not your implementation.

### **What You CAN Do:**

✅ Send your own branded email in addition  
✅ Make your email more helpful and attractive  
✅ Provide Xytek-specific onboarding instructions  
✅ Include direct links to your platform  

### **What You CANNOT Do:**

❌ Prevent Google's email  
❌ Modify Google's email content  
❌ Change the sender of Google's email  

---

## 💡 Pro Tips

### **1. Always Send Custom Emails in Production**

```javascript
// Good practice:
{
  "email": "student@example.com",
  "role": "STUDENT",
  "sendCustomEmail": true  // Always true for better UX
}
```

### **2. Handle Email Failures Gracefully**

The invitation will succeed even if the custom email fails. Check the response:

```javascript
if (response.data.customEmailSent) {
  console.log('Custom email sent successfully!');
} else {
  console.log('Invitation created, but custom email failed');
}
```

### **3. Consider Rate Limits**

Gmail API has sending limits (~100 emails/day for free accounts). For higher volume:
- Use SendGrid
- Use AWS SES
- Use Mailgun

---

## 📊 Comparison

| Without Custom Email | With Custom Email (`sendCustomEmail: true`) |
|---------------------|---------------------------------------------|
| ✅ Student receives Google email | ✅ Student receives Google email |
| ❌ No branded communication | ✅ Student receives Xytek branded email |
| ❌ Generic Google messaging | ✅ Custom onboarding instructions |
| ❌ No platform branding | ✅ Strong Xytek brand presence |
| Response: `{ invitation: {...} }` | Response: `{ invitation: {...}, customEmailSent: true }` |

---

## 🆘 Troubleshooting

### **Problem: Custom email not sending**

**Check:**
1. Gmail API scope is enabled: `https://www.googleapis.com/auth/gmail.send`
2. Teacher has valid OAuth2 tokens
3. Check server logs for email errors

### **Problem: Emails going to spam**

**Solutions:**
1. Use SendGrid/AWS SES for better deliverability
2. Set up SPF and DKIM records
3. Use a verified sending domain

### **Problem: "Invalid grant" error**

**Solution:**
Teacher's OAuth2 tokens may be expired. Have them re-authenticate.

---

## 📁 Files You Need to Know

| File | Purpose |
|------|---------|
| `services/emailService.js` | Email sending functions |
| `controllers/classroom.controller.js` | Invitation API endpoints |
| `test-custom-invite.js` | Test script |
| `CLASSROOM_EMAIL_INVITATION_GUIDE.md` | Detailed documentation |
| `EMAIL_COMPARISON.md` | Email comparison guide |

---

## ✅ Checklist

Before using in production:

- [ ] Test with real email addresses
- [ ] Check spam folder
- [ ] Verify email design in different clients
- [ ] Customize colors to match your brand
- [ ] Add your logo
- [ ] Consider upgrading to SendGrid/AWS SES
- [ ] Monitor email delivery rates
- [ ] Set up error logging

---

## 🎯 Summary

**To use custom Xytek emails:**

1. Add `"sendCustomEmail": true` to your API request
2. That's it! Everything else is automatic.

**What happens:**

1. ✅ Google Classroom invitation created
2. ✅ Google sends their email (automatic, can't prevent)
3. ✅ Your system sends custom Xytek email (beautiful HTML)
4. ✅ Student gets both emails
5. ✅ Student engages with your better-designed email

**Result:** Better branding, better UX, happier students! 🎉

---

**Need Help?** See `CLASSROOM_EMAIL_INVITATION_GUIDE.md` for detailed documentation.

**Last Updated:** November 2025

