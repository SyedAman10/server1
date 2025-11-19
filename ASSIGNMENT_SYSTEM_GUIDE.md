# Assignment System Guide

## Overview
The assignment system allows teachers and super admins to create assignments in courses. All enrolled students automatically receive an email notification when a new assignment is posted.

## Features
✅ Database-driven (PostgreSQL) - No Google Classroom dependency  
✅ Only teachers and super_admins can create assignments  
✅ Automatic email notifications to all enrolled students  
✅ XYTEK branding in emails  
✅ AI agent integration for natural language assignment creation  
✅ Support for due dates and points  
✅ List upcoming assignments  

## Database Schema

The `assignments` table includes:
- `id` - Auto-incrementing primary key
- `course_id` - References the course
- `teacher_id` - References the teacher who created it
- `title` - Assignment title (required)
- `description` - Assignment description/instructions
- `due_date` - Assignment due date (timestamp)
- `max_points` - Maximum points (default: 100)
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Setup

1. **Run the database migration:**
```bash
node scripts/init-database.js
```

This will add the `teacher_id` column to the assignments table if it doesn't exist.

2. **Restart the server:**
```bash
pm2 restart index
```

## API Endpoints

### 1. Create Assignment
**POST** `/api/assignments`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "courseId": "7tH1QQyTaV2X",
  "title": "Homework Assignment 1",
  "description": "Complete exercises 1-10 from Chapter 3",
  "dueDate": "2025-11-30T23:59:00Z",
  "maxPoints": 100
}
```

**Response:**
```json
{
  "success": true,
  "assignment": {
    "id": 1,
    "course_id": "7tH1QQyTaV2X",
    "teacher_id": 1,
    "title": "Homework Assignment 1",
    "description": "Complete exercises 1-10 from Chapter 3",
    "due_date": "2025-11-30T23:59:00Z",
    "max_points": 100,
    "created_at": "2025-11-19T18:00:00Z",
    "updated_at": "2025-11-19T18:00:00Z"
  },
  "emailsSent": 5,
  "message": "Assignment created and sent to 5 student(s)!"
}
```

### 2. Get Assignments for a Course
**GET** `/api/assignments/course/:courseId`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "assignments": [
    {
      "id": 1,
      "course_id": "7tH1QQyTaV2X",
      "teacher_id": 1,
      "title": "Homework Assignment 1",
      "description": "Complete exercises 1-10 from Chapter 3",
      "due_date": "2025-11-30T23:59:00Z",
      "max_points": 100,
      "created_at": "2025-11-19T18:00:00Z",
      "updated_at": "2025-11-19T18:00:00Z",
      "teacher_name": "John Teacher",
      "teacher_email": "teacher@example.com",
      "course_name": "AI support3"
    }
  ],
  "count": 1
}
```

### 3. Get Single Assignment
**GET** `/api/assignments/:assignmentId`

### 4. Update Assignment
**PUT** `/api/assignments/:assignmentId`

**Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "dueDate": "2025-12-01T23:59:00Z",
  "maxPoints": 150
}
```

### 5. Delete Assignment
**DELETE** `/api/assignments/:assignmentId`

### 6. Get Upcoming Assignments
**GET** `/api/assignments/upcoming?days=7`

Returns all assignments due within the next 7 days (default).

## Email Notifications

When an assignment is created, all enrolled students receive an email with:
- 📝 Icon and XYTEK Classroom Assistant branding
- Course name
- Assignment title and description
- Due date and time
- Maximum points
- Teacher name
- Professional styling

## Using with AI Agent

The AI agent automatically uses the new database system for assignments.

### Example AI Commands:

1. **Create an assignment:**
```
"Create an assignment in AI support3 called Homework 1 due tomorrow at 6pm"
```

2. **Create assignment with description:**
```
"Create assignment Math Quiz for Math 101, due December 1st, description: Complete problems 1-20"
```

3. **Create assignment with points:**
```
"Create Final Project assignment in CS101, due Dec 15, worth 200 points"
```

## Testing with cURL

### Test Creating an Assignment

First, get a JWT token for a teacher account:
```bash
curl -X POST https://class.xytek.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "your_password"
  }'
```

Then create an assignment:
```bash
curl -X POST https://class.xytek.ai/api/assignments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "courseId": "7tH1QQyTaV2X",
    "title": "Homework Assignment 1",
    "description": "Complete exercises 1-10 from Chapter 3",
    "dueDate": "2025-11-30T23:59:00Z",
    "maxPoints": 100
  }'
```

### Test with AI Agent

```bash
curl -X POST https://class.xytek.ai/api/ai/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "Create an assignment in AI support3 called Homework 1 due tomorrow",
    "conversationId": "test-conversation-123"
  }'
```

## Permissions

- **Teachers:** Can create, update, delete, and view assignments for their own courses
- **Super Admins:** Can create, update, delete, and view all assignments
- **Students:** Can only view assignments for courses they're enrolled in

## Email Configuration

Make sure your `.env` file has the following configured:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM_NAME=XYTEK Classroom Assistant
```

## Troubleshooting

### Assignments not sending emails?
1. Check that students are enrolled in the course
2. Verify email configuration in `.env`
3. Check server logs for email errors

### AI agent not creating assignments?
1. Ensure the user is a teacher or super_admin
2. Check that the course name is correct
3. Verify the course exists in the database

### Students not receiving emails?
1. Check spam folders
2. Verify student email addresses in the database
3. Check email service logs for bounce notifications

## Migration from Google Classroom

The system has been fully migrated from Google Classroom to the database:
- ✅ No Google OAuth required for assignments
- ✅ Assignments stored in PostgreSQL
- ✅ Email notifications via Nodemailer
- ✅ Complete control over assignment data
- ✅ XYTEK branding instead of Google branding

## Files Created/Updated

### New Files:
- `models/assignment.model.js` - Database operations
- `services/newAssignmentService.js` - Business logic
- `services/assignmentEmailService.js` - Email notifications
- `controllers/newAssignment.controller.js` - API endpoints
- `routes/newAssignment.routes.js` - Route definitions

### Backup Files:
- `services/assignmentService.classroom.backup.js` - Old Google Classroom service
- `controllers/assignment.controller.classroom.backup.js` - Old controller
- `routes/assignment.routes.classroom.backup.js` - Old routes

### Updated Files:
- `scripts/init-database.js` - Added `teacher_id` column check
- `index.js` - Updated to use new assignment routes
- `services/ai/actionExecution.js` - Updated to use database system

## Next Steps

1. Run the database migration script
2. Restart PM2
3. Test creating an assignment via API
4. Test with AI agent
5. Verify email delivery to students
6. Optionally delete backup files once confirmed working

## Assignment Features Roadmap

Future enhancements:
- [ ] File attachments
- [ ] Submission tracking
- [ ] Grading system
- [ ] Late submission penalties
- [ ] Assignment categories/tags
- [ ] Recurring assignments
- [ ] Draft assignments
- [ ] Student submission emails

