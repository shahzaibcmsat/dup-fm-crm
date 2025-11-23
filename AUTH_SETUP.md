# Authentication Setup Guide

## Overview
This CRM now has proper username/password authentication with Row Level Security (RLS) support.

## Default Credentials

### Admin User
- **Username**: `Admin`
- **Password**: `Admin@123`
- **Role**: admin (full access)

### Client User
- **Username**: `FMD`
- **Password**: `FMD@123`
- **Role**: user (standard access)

## Setup Instructions

### 1. Run Database Migrations

First, create the users table:

```bash
# Connect to your Supabase/PostgreSQL database and run:
psql -h your-host -U your-user -d your-database -f migrations/add_users_table.sql
```

### 2. Enable Row Level Security (RLS)

Enable RLS on all tables to restrict access to authenticated users only:

```bash
psql -h your-host -U your-user -d your-database -f migrations/enable_rls.sql
```

### 3. Add SESSION_SECRET to .env

Add a strong session secret to your `.env` file:

```bash
SESSION_SECRET=your-very-long-random-secret-key-here-change-this-in-production
```

Generate a secure random key:
```bash
# On Windows PowerShell:
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})

# On Linux/Mac:
openssl rand -base64 64
```

### 4. Restart the Server

```bash
npm run dev
```

## Security Features

### Password Hashing
- Passwords are hashed using bcrypt with 10 salt rounds
- Password hashes are never returned in API responses

### Session Management
- Sessions expire after 24 hours of inactivity
- Secure cookies in production (HTTPS only)
- HTTP-only cookies to prevent XSS attacks

### Row Level Security (RLS)
- All tables have RLS enabled
- Only authenticated users can access data
- Admin role required for deletions and sensitive operations
- Policies enforce access control at the database level

## API Endpoints

### Authentication

#### POST /api/auth/login
Login with username and password.
```json
{
  "username": "Admin",
  "password": "Admin@123"
}
```

#### POST /api/auth/logout
Logout the current user. Requires authentication.

#### GET /api/auth/me
Check current authentication status.

#### POST /api/auth/register (Admin only)
Create a new user account.
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "SecurePassword123",
  "role": "user"
}
```

## Protected Routes

All API routes under `/api/leads`, `/api/emails`, `/api/companies`, `/api/inventory`, `/api/notifications`, and `/api/config` require authentication.

Unauthorized requests will receive a `401 Unauthorized` response.

## User Roles

### Admin Role
- Full access to all features
- Can create/delete users
- Can delete leads, emails, and inventory
- Can modify system configuration

### User Role
- Can view all data
- Can create and update leads
- Can send/receive emails
- Cannot delete data (except their own creations)
- Cannot modify system configuration

## Updating Passwords

To update a user's password, use SQL:

```sql
-- Update password (replace with bcrypt hash)
UPDATE users 
SET password_hash = '$2b$10$...' -- bcrypt hash of new password
WHERE username = 'Admin';
```

Or use Node.js/TypeScript:

```typescript
import { hashPassword } from './server/auth';

const newHash = await hashPassword('NewPassword123');
// Then update in database
```

## Deactivating Users

```sql
UPDATE users SET is_active = false WHERE username = 'username';
```

## Security Best Practices

1. **Change default passwords immediately** in production
2. **Use strong passwords** (12+ characters, mixed case, numbers, symbols)
3. **Keep SESSION_SECRET secure** and never commit it to version control
4. **Use HTTPS in production** to protect session cookies
5. **Regularly audit user access** and remove inactive users
6. **Enable MFA** for admin accounts (future enhancement)
7. **Monitor failed login attempts** (future enhancement)

## Troubleshooting

### Can't log in after migration
- Ensure the users table was created successfully
- Check that password hashes are properly stored
- Verify SESSION_SECRET is set in .env

### RLS blocking queries
- Ensure you're authenticated (check `/api/auth/me`)
- Verify RLS policies are correctly applied
- Check database user has proper permissions

### Session expires immediately
- Check SESSION_SECRET is set
- Verify cookie settings (secure flag in production)
- Check server time is synchronized

## Next Steps

After setup:
1. Change default passwords
2. Create additional user accounts as needed
3. Test authentication flow
4. Verify RLS policies are working
5. Monitor authentication logs
