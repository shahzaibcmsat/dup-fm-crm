# Quick Authentication Setup Guide

## 🚀 Quick Start

### 1. Run the Authentication Migration

```bash
npx tsx run-auth-migrations.ts
```

This will create the `users` table and insert default users.

### 2. Add Session Secret

Add this line to your `.env` file:

```bash
# Generate a secure random secret (PowerShell):
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})

# Then add to .env:
SESSION_SECRET=your-generated-secret-here
```

### 3. (Optional) Enable Row Level Security

If using Supabase, run this in the SQL Editor:

```bash
# Copy content from: migrations/enable_rls.sql
# Paste and execute in Supabase SQL Editor
```

### 4. Restart Server

```bash
npm run dev
```

### 5. Login!

Navigate to `http://localhost:5000/login`

**Default Credentials:**
- **Admin**: `Admin` / `Admin@123`
- **Client**: `FMD` / `FMD@123`

## 🔐 Security Features

✅ **Password Hashing** - bcrypt with 10 salt rounds  
✅ **Session Management** - 24-hour sessions with HTTP-only cookies  
✅ **Row Level Security** - Database-level access control  
✅ **Role-Based Access** - Admin and user roles  
✅ **Protected API Routes** - All endpoints require authentication  

## 👥 User Management

### Create New User

```bash
npx tsx server/create-user.ts
```

Follow the prompts to create a new user.

### Update Password

```bash
npx tsx server/create-user.ts
# Select option 4: Update user password
```

### List All Users

```bash
npx tsx server/create-user.ts
# Select option 3: List all users
```

## 🛡️ API Authentication

All API requests require authentication. The session cookie is automatically included.

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "Admin",
  "password": "Admin@123"
}
```

### Check Auth Status
```bash
GET /api/auth/me
```

### Logout
```bash
POST /api/auth/logout
```

## 🔑 Permissions

### Admin Role
- Full access to all features
- Can delete data
- Can manage users
- Can modify configuration

### User Role
- Can view all data
- Can create/edit leads
- Can send/receive emails
- Cannot delete data
- Cannot modify configuration

## 📚 More Info

See `AUTH_SETUP.md` for detailed documentation.

## ⚠️ Important

**Change default passwords immediately in production!**

```bash
npx tsx server/create-user.ts
# Select option 4 and update passwords
```
