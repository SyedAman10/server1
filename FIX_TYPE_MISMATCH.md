# 🔧 Fix Type Mismatch Error

## The Problem:
```
Error: inconsistent types deduced for parameter $6
Detail: integer versus character varying
```

Your database has:
- `teacher_id` as **INTEGER**
- `owner_id` as **VARCHAR** (or vice versa)

We were using the same value for both columns, causing PostgreSQL to get confused about the type.

---

## ✅ The Fix:

Updated `models/course.model.js` to:
1. Check the data type of `owner_id` column
2. Convert `teacherId` to string if `owner_id` is VARCHAR
3. Use separate parameters instead of reusing the same one

### Before:
```javascript
VALUES ($1, $2, $3, $4, $5, $6, $6)  // ❌ PostgreSQL confused!
values = [courseId, name, desc, section, room, teacherId]
```

### After:
```javascript
VALUES ($1, $2, $3, $4, $5, $6, $7)  // ✅ Separate parameters!
values = [courseId, name, desc, section, room, teacherId, ownerId]
// ownerId is converted to string if owner_id column is VARCHAR
```

---

## 🚀 Deploy to Server:

```bash
# SSH to your server
ssh ubuntu@your-server
cd /home/ubuntu/server1

# Pull updated code (if using git)
git pull

# Restart PM2
pm2 restart index

# Watch logs
pm2 logs index --lines 50
```

---

## 🧪 Test It:

```bash
curl -X POST https://class.xytek.ai/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message":"create a course called Final Test Course"}'
```

Should now work perfectly! ✅

---

## 📊 What the Code Does:

1. **Checks `owner_id` type** on first use
2. **Converts if needed**: 
   - If `owner_id` is VARCHAR → converts `teacherId` to string
   - If `owner_id` is INTEGER → keeps `teacherId` as number
3. **Uses correct types** in the SQL query

The code now adapts to your exact database schema! 🎉

