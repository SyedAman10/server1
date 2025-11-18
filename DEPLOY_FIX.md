# 🚀 Deploy Fix for owner_id Issue

## The Problem:
Your existing database has `owner_id` column (NOT NULL), but our new code was only using `teacher_id`.

## ✅ The Fix:
Updated the code to populate BOTH `owner_id` and `teacher_id` columns when creating courses.

---

## 📝 Deploy Steps:

### 1. SSH to Your Server:
```bash
ssh ubuntu@your-server
cd /home/ubuntu/server1
```

### 2. Pull the Updated Code:
If you're using git:
```bash
git pull origin main
```

Or manually update these files:
- `models/course.model.js` 
- `scripts/init-database.js`

### 3. Restart PM2:
```bash
pm2 restart index
```

### 4. Test It:
```bash
curl -X POST https://class.xytek.ai/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message":"create a course called Test Course"}'
```

---

## 🔍 What Changed:

### Before:
```sql
INSERT INTO courses (name, description, section, room, teacher_id)
VALUES ('Course', 'Desc', 'A', 'R1', 1)
-- Error: owner_id is NULL but NOT NULL constraint!
```

### After:
```sql
INSERT INTO courses (name, description, section, room, teacher_id, owner_id)
VALUES ('Course', 'Desc', 'A', 'R1', 1, 1)
-- ✅ Both columns populated with same value!
```

---

## ✅ Now It Works!

Both `teacher_id` and `owner_id` get the same user ID, satisfying all constraints! 🎉

