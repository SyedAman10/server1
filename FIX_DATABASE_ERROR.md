# 🔧 Fix Database Initialization Error

## Your Error:
```
Error: column "teacher_id" does not exist
```

## ✅ The Fix Is Ready!

I've updated the `scripts/init-database.js` script to handle your existing database tables properly. It will now:
- Check if tables already exist
- Add missing columns (like `teacher_id`, `password`, `role`)
- Create new tables only if they don't exist
- Handle all migrations automatically

## 📝 Steps to Run on Your Server:

### Step 1: SSH to Your Server
```bash
ssh your-server
cd /home/ubuntu/server1
```

### Step 2: Make Sure .env Has DATABASE_URL

Check your `.env` file:
```bash
cat .env | grep DATABASE_URL
```

If it's not there, add it:
```bash
nano .env
```

Add this line:
```env
DATABASE_URL=postgresql://your-neon-connection-string
JWT_SECRET=your-secret-key-here
```

### Step 3: Run the Updated Script
```bash
node scripts/init-database.js
```

### Expected Output:
```
🚀 Starting database initialization...
⚠️  Users table already exists. Checking structure...
➕ Adding password column to users table...
➕ Adding role column to users table...
✅ Users table structure verified
✅ Users email index created
⚠️  Courses table already exists. Checking structure...
➕ Adding teacher_id column to courses table...
✅ Courses table structure verified
✅ Courses teacher_id index created
✅ Course enrollments table created successfully
✅ Assignments table created successfully
✅ Assignment submissions table created successfully
🎉 Database initialization completed successfully!
```

## 🔍 What the Script Does Now:

### For Existing `users` Table:
- ✅ Checks if `password` column exists (adds if missing)
- ✅ Checks if `role` column exists (adds if missing with default 'student')
- ✅ Adds constraint to ensure role is valid (student/teacher/super_admin)
- ✅ Creates email index for faster lookups

### For Existing `courses` Table:
- ✅ Checks if `teacher_id` column exists (adds if missing)
- ✅ Adds foreign key constraint to users table
- ✅ Creates teacher_id index for faster queries

### For New Tables:
- ✅ Creates `course_enrollments` table
- ✅ Creates `assignments` table
- ✅ Creates `assignment_submissions` table

## 🚨 Troubleshooting:

### If you get connection error:
```
Error: ECONNREFUSED
```
**Solution:** Your DATABASE_URL is not set or incorrect. Check `.env` file.

### If you get permission error:
```
Error: permission denied
```
**Solution:** Your database user doesn't have permission to alter tables. Use a superuser or contact your DB admin.

### If you get constraint error:
```
Error: constraint already exists
```
**Don't worry!** The script will continue and skip existing constraints.

## 🧪 Test After Running:

### Test 1: Signup a Teacher
```bash
curl -X POST https://your-server.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@test.com",
    "password": "test123",
    "name": "Test Teacher",
    "role": "teacher"
  }'
```

### Test 2: Create a Course
Use the token from signup:
```bash
curl -X POST https://your-server.com/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Course 101"
  }'
```

## ✅ After Success:

Your database will have the correct structure and you can:
- ✅ Signup/login users with email/password
- ✅ Create courses via API or AI chat
- ✅ Enroll students in courses
- ✅ Manage assignments

## 📞 Still Having Issues?

If the script still fails, send me:
1. The exact error message
2. Your PostgreSQL version: `SELECT version();`
3. Your table structure: `\d users` and `\d courses` in psql

The updated script is much more robust and will handle your existing database properly! 🚀

