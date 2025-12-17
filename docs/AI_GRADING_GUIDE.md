# 🤖 AI Grading Agent - Complete Guide

## Overview

The AI Grading Agent is an intelligent system that automatically grades student assignments using Google's Gemini AI. It supports two modes: **Manual Approval** and **Auto Grading**.

---

## ✨ Features

### 1. **Intelligent Criteria Extraction**
- Automatically analyzes assignment descriptions
- Extracts grading criteria from assignment files
- Generates structured rubrics

### 2. **Two Grading Modes**

#### **Manual Approval Mode** (Recommended)
- AI grades the submission
- Sends email to teacher with:
  - Student's work
  - Proposed grade
  - Detailed breakdown
  - Approve/Reject buttons
- Teacher reviews and approves/rejects

#### **Auto Grading Mode**
- AI grades automatically
- Grade applied instantly
- Student receives immediate feedback
- No teacher notification

### 3. **Comprehensive Feedback**
- Detailed grading breakdown
- Strengths and improvements
- Specific suggestions
- Point-by-point criterion analysis

---

## 🚀 Getting Started

### Step 1: Initialize Database Tables

```bash
# On your server
node scripts/init-ai-grading-tables.js
```

This creates:
- `ai_grading_settings` - Stores AI grading configuration per assignment
- `ai_grades` - Stores AI-generated grades with approval tokens

### Step 2: Enable AI Grading for an Assignment

**API Endpoint:** `PUT /api/ai-grading/settings/:assignmentId`

```javascript
// Request
{
  "enabled": true,
  "mode": "manual", // or "auto"
  "aiInstructions": "Focus on code quality and documentation", // Optional
  "extractCriteria": true // Automatically extract grading criteria
}

// Response
{
  "success": true,
  "settings": {
    "id": 1,
    "assignment_id": 123,
    "enabled": true,
    "mode": "manual",
    "grading_criteria": "...",
    "rubric": { /* structured rubric */ },
    "max_points": 100
  }
}
```

### Step 3: Students Submit Assignments

When a student submits, the system:
1. Creates the submission
2. Checks if AI grading is enabled
3. If enabled:
   - Grades using AI
   - Sends appropriate notification based on mode

---

## 📋 API Endpoints

### Teacher Endpoints

#### 1. Enable/Update AI Grading Settings
```http
PUT /api/ai-grading/settings/:assignmentId
Authorization: Bearer <teacher_token>

Body:
{
  "enabled": true,
  "mode": "manual" | "auto",
  "aiInstructions": "Optional custom instructions",
  "extractCriteria": true
}
```

#### 2. Get AI Grading Settings
```http
GET /api/ai-grading/settings/:assignmentId
Authorization: Bearer <teacher_token>
```

#### 3. Generate Rubric Suggestions
```http
POST /api/ai-grading/rubric/:assignmentId
Authorization: Bearer <teacher_token>

Response:
{
  "success": true,
  "rubric": {
    "criteria": [
      {
        "name": "Code Quality",
        "points": 30,
        "description": "...",
        "levels": { ... }
      }
    ]
  }
}
```

#### 4. Get Pending AI Grades (Manual Mode)
```http
GET /api/ai-grading/pending
Authorization: Bearer <teacher_token>

Response:
{
  "success": true,
  "pendingGrades": [
    {
      "id": 1,
      "student_name": "John Doe",
      "assignment_title": "Essay 1",
      "proposed_grade": 85,
      "proposed_feedback": "...",
      "ai_analysis": { /* detailed breakdown */ },
      "approval_token": "abc123..."
    }
  ]
}
```

### Approval Endpoints (Public - Token-based)

#### 5. Approve AI Grade
```http
POST /api/ai-grading/approve/:token

Response:
{
  "success": true,
  "message": "Grade approved and applied successfully"
}
```

#### 6. Reject AI Grade
```http
POST /api/ai-grading/reject/:token

Body (optional):
{
  "reason": "Grade is too high, needs manual review"
}
```

---

## 📧 Email Templates

### Manual Approval Mode Email (to Teacher)

```
Subject: AI Grade Ready for Approval: John Doe - Essay 1

Body:
🤖 AI Grading Complete - Your Approval Needed

📋 Submission Details:
- Course: English 101
- Assignment: Essay 1
- Student: John Doe (john@example.com)
- Submitted: Dec 17, 2025

🎯 AI Proposed Grade:
85 / 100

Feedback:
[Detailed AI feedback]

Breakdown:
- Content Quality: 40/40
- Grammar & Style: 25/30
- Structure: 20/30

📝 Student's Submission:
[Student's text]

[Approve Button] [Reject Button]
```

### Auto Mode Email (to Student)

```
Subject: Your Essay 1 has been graded

Body:
📊 Assignment Graded (AI)

Your assignment has been automatically graded:
- Assignment: Essay 1
- Grade: 85 / 100

Feedback:
[AI feedback]

[View Assignment]
```

---

## 🎯 How AI Grading Works

### 1. Criteria Extraction
```javascript
// When AI grading is enabled, the system:
1. Analyzes assignment title & description
2. Checks for attached instruction files
3. Extracts:
   - Grading criteria
   - Point distribution
   - Quality indicators
   - Requirements
```

### 2. Submission Grading
```javascript
// When student submits:
1. AI receives:
   - Assignment criteria & rubric
   - Student's submission text
   - Attached files metadata
   - Teacher's custom instructions

2. AI generates:
   - Overall grade (0-max_points)
   - Detailed feedback
   - Criterion-by-criterion breakdown
   - Strengths & improvements
   - Specific suggestions

3. System stores:
   - Proposed grade
   - Feedback
   - Complete AI analysis
   - Approval token (if manual mode)
```

### 3. Approval Process (Manual Mode)
```javascript
// Teacher receives email with:
- Student's work
- AI's proposed grade
- Detailed analysis
- Approve/Reject links

// If approved:
- Grade applied to submission
- Student notified
- Status: "approved"

// If rejected:
- Grade not applied
- Teacher can grade manually
- Status: "rejected"
```

---

## 🔧 Configuration Options

### AI Grading Settings Schema

```javascript
{
  "assignment_id": 123,
  "teacher_id": 1,
  "enabled": true,
  "mode": "manual", // "manual" or "auto"
  "grading_criteria": "Full text of criteria...",
  "criteria_file_url": "https://...",
  "rubric": {
    "criteria": [
      {
        "name": "Content Quality",
        "points": 40,
        "levels": {
          "excellent": "Demonstrates deep understanding...",
          "good": "Shows good grasp...",
          "fair": "Basic understanding...",
          "poor": "Limited understanding..."
        }
      }
    ],
    "totalPoints": 100
  },
  "ai_instructions": "Custom instructions for AI grader"
}
```

---

## 🎓 Best Practices

### 1. **Use Manual Mode Initially**
- Test AI grading quality
- Adjust criteria if needed
- Build confidence before switching to auto

### 2. **Provide Clear Assignment Instructions**
- Detailed description helps AI understand expectations
- Include rubrics in assignment description
- Attach instruction files with grading criteria

### 3. **Custom AI Instructions**
- Add specific focus areas
- Example: "Pay special attention to code documentation"
- Example: "Focus on critical thinking and analysis"

### 4. **Review AI Patterns**
- Check pending grades regularly
- Look for patterns in AI grading
- Adjust rubrics if AI consistently misinterprets

### 5. **Student Communication**
- Inform students about AI grading
- Explain the process (especially for auto mode)
- Set expectations for feedback style

---

## 🐛 Troubleshooting

### AI Grading Not Triggering
```bash
# Check if settings are enabled
GET /api/ai-grading/settings/:assignmentId

# Verify GEMINI_API_KEY in .env
echo $GEMINI_API_KEY
```

### Email Not Received (Manual Mode)
```bash
# Check server logs
pm2 logs index

# Verify email service is working
# Check teacher email in database
```

### AI Grade Quality Issues
```javascript
// Solution 1: Add custom instructions
{
  "aiInstructions": "Be stricter with grammar, focus on thesis statement strength"
}

// Solution 2: Extract criteria again
{
  "extractCriteria": true
}

// Solution 3: Switch to manual mode
{
  "mode": "manual"
}
```

---

## 📊 Database Schema

### `ai_grading_settings`
```sql
CREATE TABLE ai_grading_settings (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER REFERENCES assignments(id),
  teacher_id INTEGER REFERENCES users(id),
  enabled BOOLEAN DEFAULT false,
  mode VARCHAR(20) DEFAULT 'manual',
  grading_criteria TEXT,
  criteria_file_url TEXT,
  rubric JSONB,
  max_points INTEGER,
  ai_instructions TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### `ai_grades`
```sql
CREATE TABLE ai_grades (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER REFERENCES assignment_submissions(id),
  assignment_id INTEGER REFERENCES assignments(id),
  student_id INTEGER REFERENCES users(id),
  teacher_id INTEGER REFERENCES users(id),
  proposed_grade DECIMAL(5,2),
  proposed_feedback TEXT,
  ai_analysis JSONB,
  status VARCHAR(20), -- 'pending', 'approved', 'rejected', 'auto_applied'
  approval_token VARCHAR(255) UNIQUE,
  approved_at TIMESTAMP,
  approved_by INTEGER,
  rejection_reason TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🚀 Deployment Checklist

- [ ] Run `node scripts/init-ai-grading-tables.js`
- [ ] Verify `GEMINI_API_KEY` in `.env`
- [ ] Test with one assignment in manual mode
- [ ] Check email delivery
- [ ] Review AI grading quality
- [ ] Train teachers on approval process
- [ ] Communicate with students
- [ ] Monitor pending grades dashboard

---

## 🎉 Success Metrics

Track these to measure AI grading effectiveness:

1. **Approval Rate**: % of AI grades approved vs rejected
2. **Time Saved**: Hours saved per week on grading
3. **Student Satisfaction**: Feedback quality ratings
4. **Accuracy**: Comparison of AI vs manual grades
5. **Turnaround Time**: Time from submission to grade

---

## 📞 Support

For issues or questions:
- Check server logs: `pm2 logs index`
- Review pending grades: `GET /api/ai-grading/pending`
- Disable problematic assignments: `PUT /api/ai-grading/settings/:id` with `enabled: false`

---

**Built with ❤️ using Google Gemini AI**

