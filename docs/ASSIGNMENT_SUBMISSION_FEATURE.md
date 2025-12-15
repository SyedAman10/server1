# AI-Powered Assignment Submission Feature

## 🎓 Overview

Students can now submit assignments through natural conversation with the AI assistant. The AI intelligently:
- Identifies which assignment to submit
- Requires file uploads for assignments with attachments
- Prevents duplicate submissions
- Confirms successful submission

## 🚀 Setup

### 1. Initialize Database Table

On your server:

```bash
cd /home/ubuntu/server1
git pull origin main
node scripts/init-submissions-table.js
pm2 restart index
```

This creates the `assignment_submissions` table with proper indexes.

## 💬 How Students Use It

### Basic Submission (No Attachment)

**Student:**
> "Submit assignment in English 101"

**AI:**
> "Which assignment in English 101 would you like to submit?"
> 1. Essay 1 (Due: Dec 20, 2025)
> 2. Homework 2 (Due: Dec 22, 2025)

**Student:**
> "Essay 1"

**AI:**
> "✅ Assignment Submitted Successfully!"

### Submission with File Upload Required

**Student:**
> "Submit homework in Math 101"

**AI:**
> "📎 File Upload Required
>
> 'Homework 2' requires a file attachment. Please upload your file using the button below."

*[Student uploads file]*

**AI:**
> "✅ Assignment Submitted Successfully!
>
> Submission Details:
> • Course: Math 101
> • Assignment: Homework 2
> • Submitted: Dec 15, 2025
> • Attachment: homework2.pdf"

### Flexible Natural Language

All these work:
- "Submit assignment in English 101"
- "Turn in homework for Math"
- "Hand in the essay for Physics 101"
- "I want to submit my assignment"
- "Submit Essay 1 in English"

## 🔧 API Endpoints

### Create Submission

```
POST /api/submissions
```

**Request:**
```json
{
  "assignmentId": 123,
  "submissionText": "Optional text",
  "attachments": [
    {
      "originalName": "file.pdf",
      "filename": "file-123.pdf",
      "url": "/uploads/assignments/file-123.pdf",
      "size": 102400,
      "mimetype": "application/pdf"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "submission": {
    "id": 1,
    "assignment_id": 123,
    "student_id": 4,
    "submission_text": "",
    "attachments": [...],
    "status": "submitted",
    "submitted_at": "2025-12-15T..."
  },
  "message": "Assignment submitted successfully"
}
```

### Get My Submissions

```
GET /api/submissions/my-submissions
```

**Response:**
```json
{
  "success": true,
  "submissions": [
    {
      "id": 1,
      "assignment_title": "Essay 1",
      "course_name": "English 101",
      "status": "submitted",
      "grade": null,
      "submitted_at": "2025-12-15T..."
    }
  ],
  "count": 1
}
```

### Get Specific Submission

```
GET /api/submissions/assignment/:assignmentId
```

## ✨ Features

### 1. Smart Assignment Detection
- AI finds the course from natural language
- Lists available assignments if multiple exist
- Accepts assignment title or number

### 2. Attachment Requirements
- Automatically detects if assignment requires files
- Shows upload UI only when needed
- Validates file is uploaded before submission

### 3. Duplicate Prevention
- Checks if student already submitted
- Provides helpful message if already submitted
- Prevents accidental resubmissions

### 4. File Upload Integration
- Same upload system as teacher file attachments
- Supports all file types
- Stores file metadata with submission

### 5. Status Tracking
- `submitted` - Initial submission
- `graded` - Teacher has graded
- `returned` - Returned to student
- `late` - Submitted after due date

## 🗄️ Database Schema

```sql
CREATE TABLE assignment_submissions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  submission_text TEXT,
  attachments JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'submitted',
  grade INTEGER,
  feedback TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, assignment_id)  -- Prevent duplicates
);
```

## 🔒 Security

- ✅ Only students can submit
- ✅ Can only submit to courses they're enrolled in
- ✅ One submission per student per assignment
- ✅ File upload requires authentication
- ✅ Attachments validated for required assignments

## 📊 Teacher View

Teachers can view submissions through:
- Assignment dashboard
- `GET /api/submissions/assignment/:id` endpoint
- Future: AI queries like "Show submissions for Essay 1"

## 🎯 Smart AI Flow

1. **Student says:** "Submit assignment"
2. **AI asks:** "Which course?"
3. **Student:** "English 101"
4. **AI lists assignments** (if multiple)
5. **Student selects** assignment
6. **AI checks** if attachment required
7. **If yes:** Shows upload UI
8. **Student uploads** file
9. **AI submits** automatically
10. **Confirmation** message shown

## 🔄 Workflow Examples

### Complete Flow with File

```
Student: "Submit homework in Math"
AI: "Which assignment in Math 101?"
    1. Homework 1
    2. Homework 2
    
Student: "Homework 2"
AI: "📎 File Upload Required - Please upload your file"

[Student uploads homework2.pdf]

AI: "✅ Assignment Submitted Successfully!
    • Course: Math 101
    • Assignment: Homework 2
    • Attachment: homework2.pdf"
```

### Single Assignment, No File

```
Student: "Submit essay in English"
AI: "✅ Assignment Submitted Successfully!
    • Course: English 101
    • Assignment: Essay 1
    • Submitted: Dec 15, 2025"
```

### Already Submitted

```
Student: "Submit homework in Math"
AI: "You've already submitted 'Homework 2' in Math 101. 
    Contact your teacher if you need to resubmit."
```

## 🚨 Error Handling

- **Course not found:** Suggests similar courses
- **No assignments:** Tells student to check with teacher
- **Assignment not found:** Lists available assignments
- **Already submitted:** Friendly message with contact info
- **File required but not uploaded:** Shows upload UI
- **Upload fails:** Retries and provides error details

## 📈 Future Enhancements

- Late submission detection
- Resubmission support (with teacher approval)
- Submission drafts
- Peer review assignments
- Group submissions
- Submission comments/notes

## 🧪 Testing

```bash
# Test submission creation
curl -X POST https://class.xytek.ai/api/submissions \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": 123,
    "attachments": []
  }'

# Test get my submissions
curl https://class.xytek.ai/api/submissions/my-submissions \
  -H "Authorization: Bearer STUDENT_TOKEN"
```

## 💡 Tips for Students

1. Be specific: "Submit Essay 1 in English" is better than just "Submit"
2. Check course name: Use the exact course name or close variation
3. Upload first: If assignment needs a file, upload before confirming
4. Check status: You can ask "What assignments are due?" to see what needs submitting

---

**Students can now submit assignments as easily as having a conversation!** 🎉

