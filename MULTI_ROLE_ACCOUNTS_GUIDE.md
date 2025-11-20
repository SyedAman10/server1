# 🔐 Multi-Role Accounts Guide

## Overview

The authentication system now supports **multiple accounts with the same email but different roles**. This means a user can have separate accounts as a:
- **Student** (`student`)
- **Teacher** (`teacher`)  
- **Super Admin** (`super_admin`)

---

## 🚀 Setup Instructions

### Step 1: Run the Database Migration

On your server, run the migration script:

```bash
cd /home/ubuntu/server1
node scripts/remove-email-unique-constraint.js
```

**Expected Output:**
```
🚀 Starting to modify users table...
🗑️  Dropping UNIQUE constraint on email...
✅ Email unique constraint removed
➕ Adding UNIQUE constraint on (email, role)...
✅ Composite unique constraint (email, role) added
📇 Creating index on (email, role)...
✅ Index created
🎉 Users table updated successfully!

✅ Now users can have multiple accounts with the same email but different roles.
```

### Step 2: Restart PM2

```bash
pm2 restart index
pm2 logs index
```

---

## 📝 API Usage

### 1. Sign Up (Multiple Accounts with Same Email)

**Create Student Account:**
```bash
curl -X POST https://class.xytek.ai/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123",
    "name": "John Doe",
    "role": "student"
  }'
```

**Create Teacher Account (Same Email):**
```bash
curl -X POST https://class.xytek.ai/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123",
    "name": "John Doe",
    "role": "teacher"
  }'
```

✅ **Both accounts will be created successfully!**

---

### 2. Login

#### **Option A: Login When You Know the Role**

If you know which role you want to login as, specify it:

```bash
curl -X POST https://class.xytek.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123",
    "role": "teacher"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "john@example.com",
    "name": "John Doe",
    "role": "teacher",
    "picture": null
  },
  "message": "Login successful"
}
```

#### **Option B: Login Without Specifying Role**

If the email has only ONE account, it will automatically log in:

```bash
curl -X POST https://class.xytek.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "single@example.com",
    "password": "password123"
  }'
```

If the email has MULTIPLE accounts, the API will return available roles:

```bash
curl -X POST https://class.xytek.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (Multiple Accounts):**
```json
{
  "success": false,
  "requiresRole": true,
  "availableRoles": ["student", "teacher"],
  "message": "Multiple accounts found. Please specify a role.",
  "accounts": [
    { "role": "student", "name": "John Doe" },
    { "role": "teacher", "name": "John Doe" }
  ]
}
```

Then the frontend should show a role selector and retry with the chosen role.

---

## 🎨 Frontend Implementation Examples

### **React Login Component**

```javascript
import { useState } from 'react';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('https://class.xytek.ai/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          role: selectedRole || undefined
        })
      });

      const data = await response.json();

      if (data.requiresRole) {
        // Multiple accounts found, show role selector
        setAvailableRoles(data.accounts);
        setShowRoleSelector(true);
      } else if (data.success) {
        // Login successful
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard';
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    setShowRoleSelector(false);
    // Automatically retry login with selected role
    handleLogin();
  };

  return (
    <div>
      {!showRoleSelector ? (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Login</button>
        </form>
      ) : (
        <div className="role-selector">
          <h3>Select Account Type</h3>
          <p>You have multiple accounts with this email. Please choose:</p>
          {availableRoles.map((account) => (
            <button
              key={account.role}
              onClick={() => handleRoleSelection(account.role)}
              className="role-button"
            >
              <strong>{account.role.toUpperCase()}</strong>
              <span>{account.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### **React Sign Up Component**

```javascript
import { useState } from 'react';

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('https://class.xytek.ai/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, role })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard';
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('Signup failed');
    }
  };

  return (
    <form onSubmit={handleSignup}>
      <input
        type="text"
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password (min 6 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="student">Student</option>
        <option value="teacher">Teacher</option>
        <option value="super_admin">Super Admin</option>
      </select>
      <button type="submit">Sign Up as {role}</button>
    </form>
  );
}
```

---

## 🔍 Testing

### Test Case 1: Create Multiple Accounts

```bash
# 1. Create student account
curl -X POST https://class.xytek.ai/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User",
    "role": "student"
  }'

# ✅ Should succeed

# 2. Create teacher account with SAME email
curl -X POST https://class.xytek.ai/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User",
    "role": "teacher"
  }'

# ✅ Should succeed

# 3. Try to create another student account (duplicate)
curl -X POST https://class.xytek.ai/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User",
    "role": "student"
  }'

# ❌ Should fail: "User with this email already exists as student"
```

### Test Case 2: Login with Multiple Accounts

```bash
# 1. Login without specifying role (should return available roles)
curl -X POST https://class.xytek.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# Response: { "requiresRole": true, "availableRoles": ["student", "teacher"], ... }

# 2. Login with specific role
curl -X POST https://class.xytek.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "role": "teacher"
  }'

# ✅ Should succeed and return teacher account token
```

---

## 📊 Database Schema

### Before (Email UNIQUE)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,  -- ❌ Only one account per email
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  ...
);
```

### After (Email + Role UNIQUE)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,  -- ✅ Can have multiple with same email
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  ...
  UNIQUE (email, role)  -- ✅ But email + role must be unique
);

CREATE INDEX idx_users_email_role ON users(email, role);
```

---

## 🔒 Security Notes

1. **Same Password for All Roles**: Currently, if you use the same email for multiple accounts, you'll likely use the same password. This is fine as they're technically separate accounts.

2. **Token Contains Role**: The JWT token includes the user's role, so each account has its own token with its own role.

3. **Role Switching**: Users need to log out and log back in to switch between roles. There's no "switch role" feature (yet).

---

## ⚠️ Error Responses

### Duplicate Email + Role

```json
{
  "success": false,
  "error": "User with this email already exists as teacher"
}
```

### No Account with Specified Role

```json
{
  "success": false,
  "error": "No teacher account found with this email"
}
```

### Multiple Accounts, Role Required

```json
{
  "success": false,
  "requiresRole": true,
  "availableRoles": ["student", "teacher"],
  "message": "Multiple accounts found. Please specify a role.",
  "accounts": [
    { "role": "student", "name": "John Doe" },
    { "role": "teacher", "name": "John Doe" }
  ]
}
```

---

## 🎯 Use Cases

1. **Teacher who is also a Student**: A teaching assistant who takes classes and teaches classes
2. **Super Admin who is also a Teacher**: An administrator who also teaches courses
3. **Testing Multiple Roles**: Developers testing different role permissions with one email

---

**Created by:** XYTEK Development Team  
**Last Updated:** November 19, 2025  
**Status:** ✅ Ready for production

