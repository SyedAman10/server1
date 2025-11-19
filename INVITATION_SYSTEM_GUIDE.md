# 📧 Complete Invitation System Guide

## 🎉 What Was Created

Your project now has a complete invitation system that sends email invitations to students and teachers!

---

## 📁 Files Created/Modified

### ✅ New Files Created:
1. **`models/invitation.model.js`** - Database operations for invitations
2. **`services/invitationService.js`** - Business logic for invitations
3. **`services/invitationEmailService.js`** - Email sending with templates
4. **`controllers/invitation.controller.js`** - API handlers
5. **`routes/invitation.routes.js`** - Invitation endpoints

### ✅ Modified Files:
1. **`package.json`** - Added nodemailer
2. **`scripts/init-database.js`** - Added invitations table
3. **`index.js`** - Added invitation routes
4. **`services/ai/actionExecution.js`** - Updated INVITE_STUDENTS to use new system

---

## 🗄️ Database Schema

### Invitations Table:
```sql
CREATE TABLE invitations (
  id SERIAL PRIMARY KEY,
  course_id (VARCHAR or INTEGER) REFERENCES courses(id),
  inviter_user_id INTEGER REFERENCES users(id),
  invitee_email VARCHAR(255) NOT NULL,
  invitee_role VARCHAR(50) CHECK (invitee_role IN ('student', 'teacher')),
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  accepted_user_id INTEGER REFERENCES users(id),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
cd /home/ubuntu/server1
npm install
# This will install nodemailer
```

### 2. Run Database Migration
```bash
node scripts/init-database.js
```

Expected output:
```
✅ Invitations table created successfully
✅ Invitations indexes created
```

### 3. Configure Email Settings

Add these to your `.env` file:

```env
# Email Configuration (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM_NAME=Classroom Platform

# URLs
BACKEND_URL=https://class.xytek.ai
FRONTEND_URL=https://xytek-classroom-assistant.vercel.app
```

#### For Gmail:
1. Go to Google Account Settings
2. Security → 2-Step Verification
3. App Passwords → Generate new app password
4. Copy the 16-character password
5. Use it as `EMAIL_PASSWORD`

#### For Other Providers:
- **SendGrid**: Use API key
- **AWS SES**: Use SMTP credentials
- **Mailgun**: Use SMTP credentials

### 4. Restart Server
```bash
pm2 restart index
pm2 logs index --lines 50
```

---

## 📚 API Endpoints

### 1. Invite Single User
```bash
POST /api/invitations/invite
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "courseId": "course123",
  "inviteeEmail": "student@example.com",
  "inviteeRole": "student"
}
```

**Response:**
```json
{
  "success": true,
  "invitation": {...},
  "message": "Invitation sent to student@example.com"
}
```

### 2. Invite Multiple Users
```bash
POST /api/invitations/invite-multiple
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "courseId": "course123",
  "inviteeEmails": ["student1@example.com", "student2@example.com"],
  "inviteeRole": "student"
}
```

**Response:**
```json
{
  "success": true,
  "successful": [{...}, {...}],
  "failed": [],
  "message": "Sent 2 invitation(s), 0 failed"
}
```

### 3. Accept Invitation (from email link)
```
GET /api/invitations/accept/:token
```
This redirects to your frontend app after accepting.

### 4. Accept Invitation (API)
```bash
POST /api/invitations/accept
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "token": "invitation_token_here"
}
```

### 5. Get My Pending Invitations
```bash
GET /api/invitations/my-invitations
Authorization: Bearer YOUR_TOKEN
```

### 6. Get Course Invitations (Teachers Only)
```bash
GET /api/invitations/course/:courseId
Authorization: Bearer YOUR_TOKEN
```

### 7. Cancel Invitation (Teachers Only)
```bash
DELETE /api/invitations/:invitationId
Authorization: Bearer YOUR_TOKEN
```

---

## 🤖 AI Integration

### Via AI Chat:
```bash
curl -X POST https://class.xytek.ai/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "invite student1@test.com and student2@test.com to Computer Science 101"
  }'
```

### AI Conversation Flow:
```
Teacher: "Invite students to my course"
AI: "Which course would you like to invite students to?"
Teacher: "Computer Science 101"
AI: "Which students would you like to invite? Please provide their email addresses."
Teacher: "john@test.com, jane@test.com"
AI: "📧 Invitations Sent!
     
     Course: Computer Science 101
     
     Successfully invited:
     ✅ john@test.com
     ✅ jane@test.com
     
     2 invitation email(s) sent. Students will receive an email with a link to join the course."
```

---

## 📧 Email Templates

### Invitation Email Includes:
- ✅ Beautiful HTML design
- ✅ Course name and inviter information
- ✅ Role (student/teacher)
- ✅ Accept invitation button
- ✅ Expiration notice (7 days)
- ✅ Responsive design

### Welcome Email (after accepting):
- ✅ Welcomes user to the course
- ✅ Confirms enrollment
- ✅ Provides next steps

---

## 🔐 Security Features

1. **Unique Tokens**: 64-character random tokens for each invitation
2. **Expiration**: Invitations expire after 7 days
3. **Email Verification**: Invitations tied to specific email addresses
4. **Status Tracking**: pending → accepted/rejected/expired
5. **Role-Based Access**: Only teachers/admins can invite
6. **Permission Checks**: Validates course ownership

---

## 🎯 Use Cases

### Teacher Flow:
1. Teacher creates a course
2. Teacher invites students via AI chat or API
3. System sends email invitations
4. Students receive emails with links
5. Students click link and auto-enroll
6. Teacher sees enrolled students

### Student Flow:
1. Receives invitation email
2. Clicks "Accept Invitation" button
3. If no account: Redirected to signup with invitation token
4. If has account: Auto-enrolled in course
5. Receives welcome email
6. Can access course materials

---

## 🔧 Troubleshooting

### Email Not Sending?
```bash
# Check logs
pm2 logs index --lines 100 | grep "email"

# Test email config
node -e "
const nodemailer = require('nodemailer');
require('dotenv').config();
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
transporter.verify().then(console.log).catch(console.error);
"
```

### Invitation Token Invalid?
- Check if invitation expired (7 days)
- Verify token is correct
- Check invitation status in database

### Can't Find Invitations Table?
```bash
# Run migration again
node scripts/init-database.js
```

---

## 📊 Database Queries

### Check Pending Invitations:
```sql
SELECT * FROM invitations 
WHERE status = 'pending' 
AND expires_at > NOW();
```

### Get Course Invitations:
```sql
SELECT i.*, u.name as inviter_name 
FROM invitations i
LEFT JOIN users u ON i.inviter_user_id = u.id
WHERE i.course_id = 'YOUR_COURSE_ID';
```

### Get User's Invitations:
```sql
SELECT i.*, c.name as course_name
FROM invitations i
LEFT JOIN courses c ON i.course_id = c.id
WHERE i.invitee_email = 'user@example.com'
AND i.status = 'pending';
```

---

## ✨ Features

- ✅ **Email Invitations** with beautiful templates
- ✅ **Multi-user Invitations** (bulk invite)
- ✅ **AI Integration** (natural language invites)
- ✅ **Expiration Handling** (7-day expiry)
- ✅ **Status Tracking** (pending/accepted/rejected/expired)
- ✅ **Welcome Emails** (sent on acceptance)
- ✅ **Token-based Security** (unique tokens)
- ✅ **Role Support** (student/teacher invitations)
- ✅ **Database Integration** (PostgreSQL)
- ✅ **Error Handling** (duplicate prevention, validation)

---

## 🎉 That's It!

Your invitation system is complete! Students can now receive email invitations and join courses easily.

### Next Steps:
1. Configure email settings in `.env`
2. Run database migration
3. Restart server
4. Test by inviting a student!

**Need help?** Check the logs: `pm2 logs index --lines 100`

---

## 📞 Support

If you encounter issues:
1. Check `.env` configuration
2. Verify email credentials
3. Check database migration ran successfully
4. Review server logs
5. Test email sending directly

Happy teaching! 🎓

