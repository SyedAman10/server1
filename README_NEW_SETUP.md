# 🎓 Simplified Course Management System

## Overview
This project has been simplified to use **Neon PostgreSQL Database** instead of Google Classroom for course management. Users can now signup/login with email and password, and teachers can create courses directly in the database.

## 🚀 Quick Start

### 1. Database Setup

First, initialize the database tables:

```bash
node scripts/init-database.js
```

This will create the following tables:
- `users` - Store user accounts with roles (teacher, student, super_admin)
- `courses` - Store course information
- `course_enrollments` - Track student enrollments
- `assignments` - Store assignments for courses
- `assignment_submissions` - Track assignment submissions

### 2. Environment Variables

Make sure your `.env` file has:

```env
DATABASE_URL=your_neon_connection_string
JWT_SECRET=your_secret_key_here
PORT=3000
NODE_ENV=development
```

### 3. Start the Server

```bash
npm start
```

## 📚 API Endpoints

### Authentication Endpoints

#### Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "teacher@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "teacher"  // Options: "student", "teacher", "super_admin"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "teacher@example.com",
    "name": "John Doe",
    "role": "teacher",
    "picture": null
  },
  "message": "User registered successfully"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "teacher@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "teacher@example.com",
    "name": "John Doe",
    "role": "teacher",
    "picture": null
  },
  "message": "Login successful"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "teacher@example.com",
    "name": "John Doe",
    "role": "teacher",
    "picture": null
  }
}
```

### Course Endpoints

All course endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

#### Create Course (Teachers & Super Admin Only)
```http
POST /api/courses
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "name": "Mathematics 101",
  "description": "Introduction to Algebra",
  "section": "A",
  "room": "Room 101"
}
```

**Response:**
```json
{
  "success": true,
  "course": {
    "id": 1,
    "name": "Mathematics 101",
    "description": "Introduction to Algebra",
    "section": "A",
    "room": "Room 101",
    "teacher_id": 1,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Course \"Mathematics 101\" created successfully!"
}
```

#### Get All Courses
```http
GET /api/courses
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "courses": [
    {
      "id": 1,
      "name": "Mathematics 101",
      "description": "Introduction to Algebra",
      "section": "A",
      "room": "Room 101",
      "teacher_id": 1,
      "student_count": 5,
      "teacher_name": "John Doe",
      "teacher_email": "teacher@example.com",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

#### Get Course by ID
```http
GET /api/courses/:id
Authorization: Bearer <your_jwt_token>
```

#### Update Course (Teachers & Super Admin Only)
```http
PUT /api/courses/:id
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "name": "Mathematics 102",
  "description": "Updated description"
}
```

#### Delete Course (Teachers & Super Admin Only)
```http
DELETE /api/courses/:id
Authorization: Bearer <your_jwt_token>
```

#### Enroll Student (Teachers & Super Admin Only)
```http
POST /api/courses/:id/enroll
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "studentId": 2
}
```

#### Unenroll Student (Teachers & Super Admin Only)
```http
DELETE /api/courses/:id/students/:studentId
Authorization: Bearer <your_jwt_token>
```

#### Get Enrolled Students
```http
GET /api/courses/:id/students
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "students": [
    {
      "id": 2,
      "email": "student@example.com",
      "name": "Jane Smith",
      "picture": null,
      "enrolled_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

## 🤖 AI Agent Integration

The AI agent now uses the Neon database for course operations. Teachers can interact with the AI using natural language:

### Example Conversations:

**Create a Course:**
```
User: "Create a new course"
AI: "What would you like to call your new class?"
User: "Computer Science 101"
AI: "I'll create a course called 'Computer Science 101'. Is this correct?"
User: "yes"
AI: "Great! I've successfully created your course..."
```

**List Courses:**
```
User: "Show me my courses"
AI: "📚 Here are your courses:
     1. Computer Science 101 (Section: A)
        👥 0 students
     Total: 1 course"
```

## 🔐 User Roles

### 1. **Student**
- View enrolled courses
- View course materials and assignments
- Submit assignments
- View their grades

### 2. **Teacher**
- Create, update, and delete courses
- Enroll/unenroll students
- Create and manage assignments
- Grade student work
- Post announcements

### 3. **Super Admin**
- All teacher permissions
- View and manage all courses across all teachers
- Manage user accounts

## 🗄️ Database Schema

### Users Table
```sql
- id (SERIAL PRIMARY KEY)
- email (VARCHAR UNIQUE)
- password (VARCHAR - hashed)
- name (VARCHAR)
- picture (VARCHAR)
- role (VARCHAR - student/teacher/super_admin)
- access_token (TEXT - for OAuth)
- refresh_token (TEXT - for OAuth)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Courses Table
```sql
- id (SERIAL PRIMARY KEY)
- name (VARCHAR)
- description (TEXT)
- section (VARCHAR)
- room (VARCHAR)
- teacher_id (INTEGER - FK to users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Course Enrollments Table
```sql
- id (SERIAL PRIMARY KEY)
- course_id (INTEGER - FK to courses)
- student_id (INTEGER - FK to users)
- enrolled_at (TIMESTAMP)
- UNIQUE(course_id, student_id)
```

### Assignments Table
```sql
- id (SERIAL PRIMARY KEY)
- course_id (INTEGER - FK to courses)
- title (VARCHAR)
- description (TEXT)
- due_date (TIMESTAMP)
- max_points (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Assignment Submissions Table
```sql
- id (SERIAL PRIMARY KEY)
- assignment_id (INTEGER - FK to assignments)
- student_id (INTEGER - FK to users)
- submitted_at (TIMESTAMP)
- grade (INTEGER)
- feedback (TEXT)
- UNIQUE(assignment_id, student_id)
```

## 🧪 Testing the API

### Using cURL:

**Signup:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@test.com",
    "password": "test123",
    "name": "Test Teacher",
    "role": "teacher"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@test.com",
    "password": "test123"
  }'
```

**Create Course:**
```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Test Course",
    "description": "A test course"
  }'
```

## 📝 Notes

- Passwords are hashed using bcrypt before storage
- JWT tokens expire after 7 days
- All routes under `/api/courses` require authentication
- Teachers can only manage their own courses (except super_admins)
- Students can only view courses they're enrolled in

## 🔄 Migration from Google Classroom

The project no longer requires:
- Google OAuth credentials for course creation
- Google Classroom API access for basic course operations

OAuth is still available for additional Google services if needed.

## 🛠️ Next Steps

1. Run the database initialization script
2. Create a teacher account via signup
3. Login and get your JWT token
4. Start creating courses!

For any issues or questions, please check the error logs or contact support.

