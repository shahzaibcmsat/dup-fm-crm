-- ============================================
-- Update User Roles in Supabase Auth
-- ============================================
-- Run this in Supabase SQL Editor to set user roles

-- Set admin@fmd.com as Admin
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@fmd.com';

-- Set fmd@fmdcompanies.com as Member
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "member"}'::jsonb
WHERE email = 'fmd@fmdcompanies.com';

-- Verify the changes
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  created_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at DESC;
