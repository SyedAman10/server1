# ⚡ Quick Setup Instructions

## ✅ What Has Been Done

Your project has been successfully simplified! Here's what changed:

### 1. **Database Models Created**
- ✅ `models/user.model.js` - Updated with password authentication
- ✅ `models/course.model.js` - NEW! Complete course management
- ✅ `services/courseService.js` - NEW! Business logic for courses

### 2. **Authentication Endpoints**
- ✅ `POST /api/auth/signup` - Register new users
- ✅ `POST /api/auth/login` - Login with email/password
- ✅ `GET /api/auth/me` - Get current user info

### 3. **Course Management Endpoints**
- ✅ `POST /api/courses` - Create course (Teachers only)
- ✅ `GET /api/courses` - Get all courses
- ✅ `GET /api/courses/:id` - Get single course
- ✅ `PUT /api/courses/:id` - Update course
- ✅ `DELETE /api/courses/:id` - Delete course
- ✅ `POST /api/courses/:id/enroll` - Enroll student
- ✅ `DELETE /api/courses/:id/students/:studentId` - Unenroll student
- ✅ `GET /api/courses/:id/students` - Get enrolled students

### 4. **AI Integration Updated**
- ✅ AI "Create Course" workflow now uses Neon DB (not Google Classroom)
- ✅ AI "List Courses" workflow now uses Neon DB

### 5. **Database Schema**
- ✅ `scripts/init-database.js` - Database initialization script

## 🚀 Next Steps (Do This Now!)

### Step 1: Add Your Neon Connection String

Edit your `.env` file and add:

```env
DATABASE_URL=postgresql://YOUR_NEON_CONNECTION_STRING
JWT_SECRET=your-super-secret-jwt-key-here-change-this-to-random-string
```

### Step 2: Initialize the Database

Run this command to create all tables:

```bash
node scripts/init-database.js
```

You should see:
```
✅ Users table created successfully
✅ Courses table created successfully
✅ Course enrollments table created successfully
✅ Assignments table created successfully
✅ Assignment submissions table created successfully
🎉 Database initialization completed successfully!
```

### Step 3: Start Your Server

```bash
npm start
```

### Step 4: Test the Endpoints

#### Create a Teacher Account
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

Save the `token` from the response!

#### Create a Course
```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Computer Science 101",
    "description": "Introduction to Programming"
  }'
```

#### List Courses
```bash
curl -X GET http://localhost:3000/api/courses \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🎯 Use Cases

### For Teachers:
1. **Signup** as a teacher
2. **Login** to get JWT token
3. **Create courses** via API or AI chat
4. **Enroll students**
5. **Manage assignments**

### For Students:
1. **Signup** as a student
2. **Login** to get JWT token
3. **View enrolled courses**
4. **Submit assignments**
5. **Check grades**

### AI Chat Examples:

Teacher: "Create a new course"
AI: "What would you like to call your new class?"
Teacher: "Mathematics 101"
AI: "I'll create a course called 'Mathematics 101'. Is this correct?"
Teacher: "yes"
AI: ✅ Creates course in Neon DB

Teacher: "Show my courses"
AI: Lists all courses from Neon DB

## 📊 Database Tables Created

1. **users** - User accounts with roles
2. **courses** - Course information
3. **course_enrollments** - Student enrollments
4. **assignments** - Course assignments
5. **assignment_submissions** - Student submissions

## 🔐 Security Features

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens for authentication
- ✅ Role-based access control (teacher/student/super_admin)
- ✅ Database-level constraints
- ✅ SQL injection protection via parameterized queries

## 📝 Important Notes

1. **JWT Tokens** expire after 7 days
2. **Teachers** can only manage their own courses
3. **Super Admins** can manage all courses
4. **Students** can only view courses they're enrolled in
5. **Passwords** must be at least 6 characters

## 🐛 Troubleshooting

### Database Connection Error?
- Make sure `DATABASE_URL` is set in `.env`
- Verify your Neon connection string is correct
- Check your internet connection

### Authentication Error?
- Include JWT token in Authorization header: `Bearer YOUR_TOKEN`
- Check if token is expired (7 days)

### Permission Error?
- Verify user role (teacher/student/super_admin)
- Only teachers can create courses
- Only teachers can enroll students

## 📚 Full Documentation

See `README_NEW_SETUP.md` for complete API documentation and examples.

## ✨ That's It!

Your project is now simplified and using Neon DB instead of Google Classroom! 🎉

All you need to do is:
1. Add your Neon connection string to `.env`
2. Run `node scripts/init-database.js`
3. Start creating courses!

