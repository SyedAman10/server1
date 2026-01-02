# Assignment Submission Testing Scripts

This directory contains test scripts for testing assignment submissions and AI grading functionality.

## Test Scripts

### 1. `test-submission.js` - Full API Test
Tests the complete assignment submission workflow through the API endpoints.

**Features:**
- ✅ Authenticates with student token
- ✅ Fetches assignment details
- ✅ Submits assignment
- ✅ Checks AI grading status
- ✅ Triggers email notification to teacher

**Usage:**

```bash
# 1. First, get a student authentication token
node get-test-token.js

# 2. Edit test-submission.js and update the CONFIG:
#    - studentToken: paste the token from step 1
#    - assignmentId: ID of the assignment to submit
#    - submissionText: your test submission content

# 3. Run the test
node test-submission.js
```

**Example Output:**
```
📝 Starting assignment submission test...
📋 Step 1: Fetching assignment details...
✅ Assignment found: { id: 1, title: 'Math Homework' }
📤 Step 2: Submitting assignment...
✅ Submission successful!
🤖 Step 3: Checking AI grading status...
✅ AI Grade Generated: { grade: 85, status: 'pending' }
```

---

### 2. `test-ai-grading.js` - Direct Service Test
Directly tests the AI grading service without going through API endpoints.

**Features:**
- ✅ Bypasses API authentication
- ✅ Tests AI grading service directly
- ✅ Shows detailed grading results
- ✅ Useful for debugging AI grading issues

**Usage:**

```bash
# 1. Edit test-ai-grading.js and update TEST_CONFIG:
#    - submissionId: ID of an existing submission
#    - assignmentId: Assignment ID
#    - studentId: Student ID
#    - teacherId: Teacher ID

# 2. Make sure OPENAI_API_KEY is set in .env

# 3. Run the test
node test-ai-grading.js
```

**Example Output:**
```
🤖 Starting AI Grading Test...
📝 Step 1: Processing submission for AI grading...
✅ AI Grading Result: {
  "success": true,
  "grade": { "proposed_grade": 85, "status": "pending" }
}
```

---

## Prerequisites

### Environment Variables (.env file)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# OpenAI (Required for AI grading)
OPENAI_API_KEY=sk-...

# Email (Required for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM_NAME=XYTEK Classroom Assistant
```

### Get Student Token

Run the token generation script:
```bash
node get-test-token.js
```

This will output a JWT token that you can use in the test scripts.

---

## AI Grading Modes

The system supports three AI grading modes:

1. **manual** (default)
   - AI generates grade and feedback
   - Teacher must approve before student sees it
   - Teacher receives email with approval link

2. **auto_approve**
   - AI generates grade and feedback
   - Automatically applied to submission
   - Student sees grade immediately

3. **disabled**
   - No AI grading
   - Teacher must grade manually

---

## Troubleshooting

### Error: "No access, refresh token, API key or refresh handler callback is set"
- **Fixed!** This was caused by using Gmail API instead of nodemailer
- The fix uses the proper `submissionEmailService.js` with SMTP

### Error: "aiGradingSettingsModel.getSettings is not a function"
- **Fixed!** Changed to use correct function name: `getGradingSettings()`

### Error: "aiGradeModel.createGrade is not a function"
- **Fixed!** Changed to use correct function name: `createAIGrade()`

### AI Grading Not Working
1. Check that OPENAI_API_KEY is set in .env
2. Verify assignment has AI grading enabled
3. Check server logs for detailed error messages
4. Use `test-ai-grading.js` to test the service directly

### Email Not Sending
1. Verify EMAIL_* environment variables are set
2. For Gmail, use an App Password (not your regular password)
3. Check that EMAIL_HOST and EMAIL_PORT are correct
4. Review server logs for SMTP errors

---

## What Happens When a Student Submits?

1. **Submission Created**
   - Student submits via API or AI agent
   - Submission saved to database

2. **AI Grading (if enabled)**
   - System checks if AI grading is enabled for the assignment
   - Extracts grading criteria from assignment
   - Sends to OpenAI for grading
   - Saves AI-generated grade with status (pending/approved)

3. **Email Notification**
   - Teacher receives email notification about submission
   - If AI grading mode is "manual", teacher gets approval email too

4. **Teacher Review (for manual mode)**
   - Teacher clicks approval link in email
   - Can approve or reject AI-generated grade
   - Can modify grade/feedback before applying

---

## Quick Test Checklist

- [ ] Environment variables configured (.env)
- [ ] Database connection working
- [ ] OpenAI API key valid
- [ ] Email credentials configured
- [ ] Test student account created
- [ ] Test assignment created with AI grading enabled
- [ ] Student token obtained
- [ ] test-submission.js CONFIG updated
- [ ] Test run successful
- [ ] Email notification received
- [ ] AI grading processed
- [ ] Server logs reviewed

---

## Need Help?

Check the server logs for detailed error messages:
```bash
# If using PM2
pm2 logs index

# If running directly
# Errors will appear in the terminal
```

For more information, see:
- `docs/AI_GRADING_GUIDE.md` - Complete AI grading documentation
- `docs/ASSIGNMENT_SUBMISSION_FEATURE.md` - Submission feature details

