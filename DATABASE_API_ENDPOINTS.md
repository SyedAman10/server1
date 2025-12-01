# 🗄️ Database-Driven API Endpoints
## No Google Classroom Dependencies

All endpoints use PostgreSQL database - completely independent from Google Classroom.

---

## 📚 **1. COURSES**

### Base URL: `/api/courses`

### **GET** `/api/courses`
Get all courses for the authenticated user
- **Teacher**: Returns courses they teach
- **Student**: Returns enrolled courses
- **Super Admin**: Returns all courses

**Response:**
```json
{
  "success": true,
  "courses": [
    {
      "id": "abc123",
      "name": "Mathematics 101",
      "description": "Introduction to Calculus",
      "section": "A",
      "room": "Room 305",
      "teacher_id": 1,
      "teacher_name": "John Teacher",
      "teacher_email": "teacher@example.com",
      "student_count": 25,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### **POST** `/api/courses`
Create a new course (Teachers & Super Admin only)

**Request Body:**
```json
{
  "name": "Physics 101",
  "description": "Introduction to Physics",
  "section": "B",
  "room": "Lab 2"
}
```

### **GET** `/api/courses/:id`
Get a specific course by ID

### **PUT** `/api/courses/:id`
Update a course (Teachers & Super Admin only)

**Request Body:**
```json
{
  "name": "Updated Course Name",
  "description": "Updated description",
  "section": "C",
  "room": "Room 401"
}
```

### **DELETE** `/api/courses/:id`
Delete a course (Teachers & Super Admin only)

### **POST** `/api/courses/:id/enroll`
Enroll a student in a course (Teachers & Super Admin only)

**Request Body:**
```json
{
  "studentId": 5
}
```

### **DELETE** `/api/courses/:id/students/:studentId`
Unenroll a student from a course (Teachers & Super Admin only)

### **GET** `/api/courses/:id/students`
Get all enrolled students in a course

**Response:**
```json
{
  "success": true,
  "students": [
    {
      "id": 5,
      "name": "John Student",
      "email": "student@example.com",
      "picture": "https://...",
      "enrolled_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## 📝 **2. ASSIGNMENTS**

### Base URL: `/api/assignments`

### **POST** `/api/assignments`
Create a new assignment (Teachers & Super Admin only)

**Request Body:**
```json
{
  "courseId": "abc123",
  "title": "Homework 1: Limits and Derivatives",
  "description": "Complete exercises 1-10 from Chapter 2",
  "dueDate": "2025-12-31T23:59:59.000Z",
  "maxPoints": 100
}
```

**Response:**
```json
{
  "success": true,
  "assignment": {
    "id": 1,
    "course_id": "abc123",
    "teacher_id": 1,
    "title": "Homework 1: Limits and Derivatives",
    "description": "Complete exercises 1-10 from Chapter 2",
    "due_date": "2025-12-31T23:59:59.000Z",
    "max_points": 100,
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z"
  },
  "message": "Assignment created successfully"
}
```

### **GET** `/api/assignments/course/:courseId`
Get all assignments for a course

**Response:**
```json
{
  "success": true,
  "assignments": [
    {
      "id": 1,
      "course_id": "abc123",
      "teacher_id": 1,
      "title": "Homework 1: Limits and Derivatives",
      "description": "Complete exercises 1-10 from Chapter 2",
      "due_date": "2025-12-31T23:59:59.000Z",
      "max_points": 100,
      "course_name": "Mathematics 101",
      "teacher_name": "John Teacher",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### **GET** `/api/assignments/:assignmentId`
Get a specific assignment by ID

### **GET** `/api/assignments/upcoming?days=7`
Get upcoming assignments (next 7 days by default)

### **PUT** `/api/assignments/:assignmentId`
Update an assignment (Teachers & Super Admin only)

**Request Body:**
```json
{
  "title": "Updated Assignment Title",
  "description": "Updated description",
  "dueDate": "2026-01-15T23:59:59.000Z",
  "maxPoints": 150
}
```

### **DELETE** `/api/assignments/:assignmentId`
Delete an assignment (Teachers & Super Admin only)

---

## 📢 **3. ANNOUNCEMENTS**

### Base URL: `/api/announcements`

### **POST** `/api/announcements`
Create a new announcement (Teachers & Super Admin only)

**Request Body:**
```json
{
  "courseId": "abc123",
  "title": "Important Notice",
  "content": "Class will be held in Room 401 tomorrow"
}
```

**Response:**
```json
{
  "success": true,
  "announcement": {
    "id": 1,
    "course_id": "abc123",
    "teacher_id": 1,
    "title": "Important Notice",
    "content": "Class will be held in Room 401 tomorrow",
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z"
  },
  "message": "Announcement created successfully",
  "emailsSent": 0,
  "studentsNotified": 25
}
```

### **GET** `/api/announcements`
Get all announcements for current user
- **Teacher**: Returns announcements they created
- **Student**: Returns announcements from enrolled courses
- **Super Admin**: Returns all announcements

**Query Parameters:**
- `limit` (default: 50) - Number of announcements to return
- `offset` (default: 0) - Pagination offset

**Response:**
```json
{
  "success": true,
  "announcements": [
    {
      "id": 1,
      "course_id": "abc123",
      "teacher_id": 1,
      "title": "Important Notice",
      "content": "Class will be held in Room 401 tomorrow",
      "course_name": "Mathematics 101",
      "teacher_name": "John Teacher",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 1,
  "totalCount": 1
}
```

### **GET** `/api/announcements/course/:courseId`
Get all announcements for a specific course

**Response:**
```json
{
  "success": true,
  "announcements": [
    {
      "id": 1,
      "course_id": "abc123",
      "teacher_id": 1,
      "title": "Important Notice",
      "content": "Class will be held in Room 401 tomorrow",
      "teacher_name": "John Teacher",
      "teacher_email": "teacher@example.com",
      "course_name": "Mathematics 101",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### **GET** `/api/announcements/:announcementId`
Get a specific announcement by ID

### **PUT** `/api/announcements/:announcementId`
Update an announcement (Teachers & Super Admin only)

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content"
}
```

### **DELETE** `/api/announcements/:announcementId`
Delete an announcement (Teachers & Super Admin only)

---

## 🔐 **Authentication**

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Role-Based Access:
- **Student**: Can view courses, assignments, and announcements they have access to
- **Teacher**: Can create/update/delete their own courses, assignments, and announcements
- **Super Admin**: Full access to all resources

---

## 📊 **Database Tables**

### **courses**
- `id` (VARCHAR or SERIAL) - Unique course identifier
- `name` - Course name
- `description` - Course description
- `section` - Course section
- `room` - Room number/name
- `teacher_id` - Foreign key to users table
- `owner_id` - Alternative teacher reference
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### **assignments**
- `id` (SERIAL) - Unique assignment identifier
- `course_id` - Foreign key to courses table
- `teacher_id` - Foreign key to users table
- `title` - Assignment title
- `description` - Assignment description
- `due_date` - Due date timestamp
- `max_points` - Maximum points (default: 100)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### **announcements**
- `id` (SERIAL) - Unique announcement identifier
- `course_id` - Foreign key to courses table
- `teacher_id` - Foreign key to users table
- `title` - Announcement title (optional)
- `content` - Announcement content
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### **course_enrollments**
- `course_id` - Foreign key to courses table
- `student_id` - Foreign key to users table
- `enrolled_at` - Enrollment timestamp
- **UNIQUE** constraint on (course_id, student_id)

---

## 🚀 **Example CURL Commands**

### Get all courses:
```bash
curl -X GET https://class.xytek.ai/api/courses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create a course:
```bash
curl -X POST https://class.xytek.ai/api/courses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Physics 101",
    "description": "Introduction to Physics",
    "section": "A",
    "room": "Lab 2"
  }'
```

### Create an assignment:
```bash
curl -X POST https://class.xytek.ai/api/assignments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "abc123",
    "title": "Homework 1",
    "description": "Complete Chapter 2 exercises",
    "dueDate": "2025-12-31T23:59:59.000Z",
    "maxPoints": 100
  }'
```

### Create an announcement:
```bash
curl -X POST https://class.xytek.ai/api/announcements \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "abc123",
    "title": "Important Notice",
    "content": "Class will be held in Room 401 tomorrow"
  }'
```

### Get announcements for a course:
```bash
curl -X GET https://class.xytek.ai/api/announcements/course/abc123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ✅ **Migration Complete**

All endpoints are now **100% database-driven** with **zero Google Classroom dependencies**.

### Old vs New:

| Feature | Old Endpoint | New Endpoint |
|---------|-------------|--------------|
| List Courses | `/api/classroom` (Google API) | `/api/courses` (Database) |
| Create Course | `/api/classroom` (Google API) | `/api/courses` (Database) |
| List Assignments | `/api/classroom/:courseId/assignments` (Google API) | `/api/assignments/course/:courseId` (Database) |
| Create Assignment | `/api/classroom/:courseId/assignments` (Google API) | `/api/assignments` (Database) |
| List Announcements | `/api/classroom/:courseId/announcements` (Google API) | `/api/announcements/course/:courseId` (Database) |
| Create Announcement | `/api/classroom/:courseId/announcements` (Google API) | `/api/announcements` (Database) |

---

## 🎯 **Next Steps**

1. ✅ Update your frontend to use the new endpoints
2. ✅ Remove any Google Classroom API calls from frontend
3. ✅ Test all CRUD operations
4. ✅ Deploy and verify

**You're now running a fully independent classroom management system!** 🚀

