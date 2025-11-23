# Member Permissions System

## Overview

The FMD CRM now includes a granular permission system that allows admins to control what each member can access. This provides fine-grained control over company visibility and feature access.

## Features

### Admin Capabilities
- Full access to all companies and features
- Create and manage user accounts
- Assign specific permissions to each member through Settings page
- Control which companies each member can view
- Toggle inventory page access for each member

### Member Capabilities
- Members only see companies assigned to them by admin
- Members only see leads belonging to their assigned companies
- Inventory page visibility controlled by admin
- Import and Settings pages are admin-only

## How It Works

### Database Structure

A new `member_permissions` table stores permissions for each member:
```sql
- id: UUID (primary key)
- user_id: UUID (references Supabase auth user)
- company_ids: TEXT[] (array of company IDs member can access)
- can_see_inventory: BOOLEAN (whether member can view inventory page)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Permission Management UI

Admins can manage member permissions from **Settings > Member Permissions**:

1. **Select a Member**: Choose from dropdown list of member users
2. **Assign Companies**: Check/uncheck companies the member can access
3. **Set Inventory Access**: Toggle whether member can view inventory
4. **Save**: Click save to apply permissions

### Frontend Enforcement

#### Sidebar Filtering
- Admin: Sees all companies
- Member: Only sees assigned companies in sidebar
- Inventory link only shown if member has access

#### Page Protection
- **Company Pages**: Members redirected if accessing unassigned company
- **Inventory Page**: Shows "Access Denied" message if member lacks permission
- **Import/Settings**: Hidden from members entirely

#### Authentication Flow
1. User logs in via Supabase Auth
2. System checks user role (admin/member)
3. If member, permissions are loaded automatically
4. UI updates based on permissions

### API Endpoints

```
GET  /api/permissions/:userId   - Get permissions for specific user
GET  /api/permissions           - Get all permissions (admin only)
PUT  /api/permissions/:userId   - Update/create permissions (admin only)
DELETE /api/permissions/:userId - Delete permissions (admin only)
```

## Setup Instructions

### 1. Run Database Migration

You need to create the `member_permissions` table in your Supabase database:

```sql
-- Run this SQL in your Supabase SQL Editor
-- File: migrations/add_member_permissions.sql

CREATE TABLE IF NOT EXISTS member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_ids TEXT[] DEFAULT '{}',
  can_see_inventory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS member_permissions_user_id_idx ON member_permissions(user_id);

ALTER TABLE member_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all permissions
CREATE POLICY "Admins can manage all permissions" ON member_permissions
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Members can read their own permissions
CREATE POLICY "Members can read their own permissions" ON member_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### 2. Configure Supabase Service Role Key

The permission system requires the Supabase Service Role Key to manage user data.

Add to your environment variables:
```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important**: This is different from the `VITE_SUPABASE_ANON_KEY`. The service role key has elevated permissions for admin operations.

## Usage Examples

### Creating a Member with Limited Access

1. Admin logs in and goes to **Settings**
2. In **User Management**, create new user with role "member"
3. In **Member Permissions**, select the new member
4. Check only "FMD Cabinets" company
5. Leave inventory access unchecked
6. Click **Save Permissions**

Result: Member can only see FMD Cabinets company and its leads. No inventory access.

### Granting Full Company Access

1. Select member in Permission Management
2. Click **Select All** to grant access to all companies
3. Check **Can view Inventory page**
4. Click **Save Permissions**

Result: Member sees all companies and inventory (effectively like an admin but without user management).

### Revoking All Access

1. Select member in Permission Management
2. Click **Clear All** to remove all company access
3. Uncheck inventory access
4. Click **Save Permissions**

Result: Member sees no companies in sidebar and cannot access inventory.

## Security Considerations

- **RLS Policies**: Database-level Row Level Security ensures members can only access their permitted data
- **Frontend Filtering**: UI filters data on display for better UX
- **API Protection**: API endpoints validate permissions server-side
- **Automatic Loading**: Permissions loaded automatically on login
- **Service Role**: Admin operations use service role key for elevated permissions

## Troubleshooting

### Member Can't See Any Companies
- Check if permissions are set for that member
- Verify company IDs in permissions match actual company IDs
- Ensure member is logged in with correct account

### Permission Changes Not Reflecting
- Have member log out and log back in
- Check browser console for permission loading errors
- Verify Supabase Service Role Key is configured correctly

### "Invalid API Key" Error
- Ensure `SUPABASE_SERVICE_ROLE_KEY` environment variable is set
- Verify the key is from Supabase Dashboard > Settings > API
- Make sure it's the **service_role** key, not the anon key

## Future Enhancements

Potential additions to the permission system:
- Lead-level permissions (assign specific leads to members)
- Custom permission roles beyond admin/member
- Permission templates for quick setup
- Audit log for permission changes
- Temporary access grants with expiration
