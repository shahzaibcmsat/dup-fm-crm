-- Create member_permissions table for granular access control
CREATE TABLE IF NOT EXISTS member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_ids TEXT[] DEFAULT '{}', -- Array of company IDs the member can access
  can_see_inventory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create unique constraint to ensure one permission record per user
CREATE UNIQUE INDEX IF NOT EXISTS member_permissions_user_id_idx ON member_permissions(user_id);

-- Enable RLS on member_permissions
ALTER TABLE member_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all permissions
CREATE POLICY "Admins can manage all permissions" ON member_permissions
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Policy: Members can read their own permissions
CREATE POLICY "Members can read their own permissions" ON member_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_member_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_member_permissions_updated_at_trigger
  BEFORE UPDATE ON member_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_member_permissions_updated_at();
