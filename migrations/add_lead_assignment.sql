-- Add lead assignment columns
-- Note: auth.users.id is UUID, we store as text for flexibility
-- No foreign key constraint since auth.users is in different schema
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS assigned_to TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_by TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- Note: can_see_inventory is stored in Supabase auth.users.user_metadata
-- No need to alter our schema, we'll read/write it via Supabase Admin API

-- Update RLS policies for leads table
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view leads based on role" ON leads;
DROP POLICY IF EXISTS "Users can insert leads" ON leads;
DROP POLICY IF EXISTS "Users can update leads" ON leads;
DROP POLICY IF EXISTS "Users can delete leads" ON leads;

-- Create new policies
-- Admin can see all leads
CREATE POLICY "Admin can view all leads" ON leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Members can only see leads assigned to them
CREATE POLICY "Members can view assigned leads" ON leads
FOR SELECT
USING (
  assigned_to = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'member'
  )
);

-- Admin can insert leads
CREATE POLICY "Admin can insert leads" ON leads
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Admin can update any lead
CREATE POLICY "Admin can update leads" ON leads
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Members can update their assigned leads
CREATE POLICY "Members can update assigned leads" ON leads
FOR UPDATE
USING (
  assigned_to = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'member'
  )
);

-- Admin can delete leads
CREATE POLICY "Admin can delete leads" ON leads
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Update inventory RLS policies to use can_see_inventory flag
DROP POLICY IF EXISTS "Users can view inventory based on permissions" ON inventory;
DROP POLICY IF EXISTS "Admin can manage inventory" ON inventory;

-- Admin can see all inventory
CREATE POLICY "Admin can view inventory" ON inventory
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Members can see inventory only if they have permission (stored in user_metadata)
CREATE POLICY "Members can view inventory with permission" ON inventory
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'member'
    AND (auth.users.raw_user_meta_data->>'canSeeInventory')::boolean = true
  )
);

-- Admin can manage inventory
CREATE POLICY "Admin can insert inventory" ON inventory
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admin can update inventory" ON inventory
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admin can delete inventory" ON inventory
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);
