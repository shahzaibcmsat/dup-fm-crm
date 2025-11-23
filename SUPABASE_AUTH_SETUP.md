# 🚀 Supabase Authentication Setup Guide

## Overview
This CRM now uses **Supabase Auth** - a simple, secure authentication system that requires minimal code!

---

## ✅ Step 1: Get Supabase Credentials

1. Go to your **Supabase Project Dashboard**
2. Click **Settings** → **API**
3. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

---

## ✅ Step 2: Add to .env File

Create/update your `.env` file:

```bash
# Your existing DATABASE_URL
DATABASE_URL=your-existing-database-url

# Add these Supabase credentials
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...your-anon-key

# Your existing Gmail/Groq config...
```

---

## ✅ Step 3: Enable Row Level Security (RLS)

In Supabase Dashboard:

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy/paste the content of `migrations/supabase_rls.sql`
4. Click **Run**

This will:
- Enable RLS on all tables
- Create policies: only authenticated users can access data
- Protect your database at the database level

---

## ✅ Step 4: Create Users in Supabase

### Option A: Via Supabase Dashboard (Easiest)

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter:
   - **Email**: `admin@fmdcompanies.com`
   - **Password**: `Admin@123` (change in production!)
   - **Auto confirm**: ✅ Yes
4. Click **Create user**

5. Click on the user → **User metadata** tab
6. Add this JSON:
   ```json
   {
     "role": "admin"
   }
   ```

7. Repeat for client user:
   - **Email**: `client@fmdcompanies.com`
   - **Password**: `FMD@123`
   - **User metadata**: `{"role": "user"}`

### Option B: Via SQL (Advanced)

Run this in SQL Editor:

```sql
-- Enable email confirmation bypass for development
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;
```

---

## ✅ Step 5: Restart Your App

```bash
npm run dev
```

---

## ✅ Step 6: Test Login

1. Navigate to `http://localhost:5000/login`
2. Login with:
   - **Email**: `admin@fmdcompanies.com`
   - **Password**: `Admin@123`

🎉 **Done!** You're now using Supabase Auth!

---

## 🔐 Security Features

✅ **Built-in password hashing** (bcrypt)  
✅ **Email verification** (optional)  
✅ **Password reset** (built-in)  
✅ **Row Level Security** (database-level protection)  
✅ **Session management** (automatic)  
✅ **Secure by default** (battle-tested)  

---

## 📱 User Management

### Create New User

**Via Supabase Dashboard:**
1. Authentication → Users → Add user
2. Enter email and password
3. Add role in user metadata: `{"role": "admin"}` or `{"role": "user"}`

**Via SQL:**
```sql
-- This will trigger Supabase to send a signup email
-- Or you can manually confirm:
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('user@example.com', crypt('password123', gen_salt('bf')), NOW());
```

### Reset Password

Users can reset via Supabase's built-in flow:
1. Supabase Dashboard → Authentication → Users
2. Click user → **Send password recovery**
3. User receives email with reset link

### Deactivate User

```sql
-- Ban user
UPDATE auth.users SET banned_until = 'infinity' WHERE email = 'user@example.com';

-- Unban user
UPDATE auth.users SET banned_until = NULL WHERE email = 'user@example.com';
```

---

## 🎯 How It Works

### Login Flow
1. User enters **email/password** on login page
2. Frontend calls `supabase.auth.signInWithPassword()`
3. Supabase validates credentials
4. Returns session token (stored in browser)
5. All API requests include session token
6. Database RLS policies check: `auth.uid() IS NOT NULL`
7. If authenticated → access granted ✅
8. If not → access denied ❌

### RLS Protection
```sql
-- Example: This policy allows only authenticated users
CREATE POLICY "auth_only" ON leads
  FOR ALL USING (auth.uid() IS NOT NULL);
```

The database automatically:
- Checks if user is logged in
- Blocks unauthenticated requests
- No backend code needed!

---

## ⚙️ Configuration

### Optional: Email Confirmation

To require email confirmation:

1. Supabase Dashboard → **Authentication** → **Settings**
2. **Email Auth** section
3. Toggle **Enable email confirmations**

Users must click email link before logging in.

### Optional: Social Login

Add Google/GitHub login:

1. Supabase Dashboard → **Authentication** → **Providers**
2. Enable Google/GitHub/etc
3. Add credentials from their developer consoles
4. Users can now login with social accounts!

---

## 🐛 Troubleshooting

### Can't log in

**Check 1:** Verify Supabase credentials in `.env`
```bash
# Should match your Supabase project
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Check 2:** Verify user exists in Supabase
- Dashboard → Authentication → Users
- User should be there and **confirmed**

**Check 3:** Check browser console for errors
- Press F12 → Console tab
- Look for Supabase auth errors

### RLS blocking access

**Check 1:** Verify RLS policies are created
```sql
-- Run in SQL Editor
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

**Check 2:** Verify user is authenticated
```sql
-- Run this in SQL Editor (should show your user)
SELECT auth.uid(), auth.email();
```

**Check 3:** Test with RLS disabled (temporarily)
```sql
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
-- Try your app
-- Then re-enable:
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
```

### Session expires quickly

Supabase sessions last **1 hour** by default and auto-refresh.

To change:
1. Supabase Dashboard → **Authentication** → **Settings**
2. **JWT expiry limit**: Change to desired seconds

---

## 🔄 Migration from Old Auth

If you had the old custom auth system:

1. Old users in `users` table won't work
2. Create new users in Supabase Auth
3. Old login data in localStorage is ignored
4. All sessions are now managed by Supabase

---

## 📚 Additional Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

---

## ⚠️ Production Checklist

Before deploying:

- [ ] Change all default passwords
- [ ] Use strong passwords (12+ characters)
- [ ] Add VITE_SUPABASE_URL to production environment
- [ ] Add VITE_SUPABASE_ANON_KEY to production environment
- [ ] Enable email confirmation (optional)
- [ ] Set up password recovery email templates
- [ ] Review RLS policies for your use case
- [ ] Test login/logout flow
- [ ] Test that unauthenticated users can't access data

---

**That's it!** Much simpler than custom auth, right? 😊
