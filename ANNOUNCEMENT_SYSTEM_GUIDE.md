# Announcement System Guide

## Overview
The announcement system allows teachers and super admins to post announcements to courses. All enrolled students in the course will automatically receive an email notification with the announcement.

## Features
✅ Database-driven (PostgreSQL) - No Google Classroom dependency  
✅ Only teachers and super_admins can create announcements  
✅ Automatic email notifications to all enrolled students  
✅ XYTEK branding in emails  
✅ AI agent integration for natural language announcements  
✅ Support for titled and untitled announcements  

## Database Schema

The `announcements` table includes:
- `id` - Auto-incrementing primary key
- `course_id` - References the course
- `teacher_id` - References the teacher who created it
- `title` - Optional announcement title
- `content` - The announcement text (required)
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Setup

1. **Run the database migration:**
```bash
node scripts/init-database.js
```

This will create the `announcements` table if it doesn't exist.

2. **Restart the server:**
```bash
pm2 restart index
```

## API Endpoints

### 1. Create Announcement
**POST** `/api/announcements`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "courseId": "1",
  "title": "Important Update",
  "content": "Please submit your assignments by Friday."
}
```

**Response:**
```json
{
  "success": true,
  "announcement": {
    "id": 1,
    "course_id": "1",
    "teacher_id": 1,
    "title": "Important Update",
    "content": "Please submit your assignments by Friday.",
    "created_at": "2025-11-19T10:00:00Z",
    "updated_at": "2025-11-19T10:00:00Z"
  },
  "emailsSent": 5,
  "message": "Announcement created and sent to 5 student(s)!"
}
```

### 2. Get Announcements for a Course
**GET** `/api/announcements/course/:courseId`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "announcements": [
    {
      "id": 1,
      "course_id": "1",
      "teacher_id": 1,
      "title": "Important Update",
      "content": "Please submit your assignments by Friday.",
      "created_at": "2025-11-19T10:00:00Z",
      "updated_at": "2025-11-19T10:00:00Z",
      "teacher_name": "John Teacher",
      "teacher_email": "teacher@example.com"
    }
  ],
  "count": 1
}
```

### 3. Get Single Announcement
**GET** `/api/announcements/:announcementId`

### 4. Update Announcement
**PUT** `/api/announcements/:announcementId`

**Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content"
}
```

### 5. Delete Announcement
**DELETE** `/api/announcements/:announcementId`

## Email Notifications

When an announcement is created, all enrolled students receive an email with:
- 📢 Icon and XYTEK Classroom Assistant branding
- Course name
- Announcement title (if provided)
- Announcement content
- Teacher name who posted it
- Professional styling

## Using with AI Agent

The AI agent automatically uses the new database system for announcements.

### Example AI Commands:

1. **Create an announcement:**
```
"Announce to AI support3 that homework is due tomorrow"
```

2. **View announcements:**
```
"Show me announcements for AI support3"
```

3. **Send assignment reminders:**
```
"Send reminder about upcoming assignments"
```

## Testing with cURL

### Test Creating an Announcement

First, get a JWT token for a teacher account:
```bash
curl -X POST https://class.xytek.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "your_password"
  }'
```

Then create an announcement:
```bash
curl -X POST https://class.xytek.ai/api/announcements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "courseId": "7tH1QQyTaV2X",
    "title": "Class Update",
    "content": "Please remember to submit your homework by Friday. Good luck!"
  }'
```

### Test with AI Agent

```bash
curl -X POST https://class.xytek.ai/api/ai/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "Announce to AI support3: Please submit your assignments by Friday!",
    "conversationId": "test-conversation-123"
  }'
```

## Permissions

- **Teachers:** Can create, update, delete, and view announcements for their own courses
- **Super Admins:** Can create, update, delete, and view all announcements
- **Students:** Can only view announcements for courses they're enrolled in

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

### Announcements not sending emails?
1. Check that students are enrolled in the course
2. Verify email configuration in `.env`
3. Check server logs for email errors

### AI agent not creating announcements?
1. Ensure the user is a teacher or super_admin
2. Check that the course name is correct
3. Verify the course exists in the database

### Students not receiving emails?
1. Check spam folders
2. Verify student email addresses in the database
3. Check email service logs for bounce notifications

## Migration from Google Classroom

The system has been fully migrated from Google Classroom to the database:
- ✅ No Google OAuth required for announcements
- ✅ Announcements stored in PostgreSQL
- ✅ Email notifications via Nodemailer
- ✅ Complete control over announcement data
- ✅ XYTEK branding instead of Google branding

## Next Steps

1. Run the database migration script
2. Restart PM2
3. Test creating an announcement via API
4. Test with AI agent
5. Verify email delivery to students

