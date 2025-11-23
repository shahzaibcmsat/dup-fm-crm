-- Enable Row Level Security (RLS) on all tables
-- This ensures only authenticated users can access data

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
-- Only authenticated users can read their own data
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid()::text = id OR auth.role() = 'admin');

-- Admins can insert/update users
CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  USING (auth.role() = 'admin');

-- Create policies for companies table
-- All authenticated users can read companies
CREATE POLICY "Authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete companies
CREATE POLICY "Admins can manage companies"
  ON companies FOR ALL
  TO authenticated
  USING (auth.role() = 'admin');

-- Create policies for leads table
-- All authenticated users can read leads
CREATE POLICY "Authenticated users can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create leads
CREATE POLICY "Authenticated users can create leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update leads (status, notes, etc.)
CREATE POLICY "Authenticated users can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (true);

-- Only admins can delete leads
CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (auth.role() = 'admin');

-- Create policies for emails table
-- All authenticated users can read emails
CREATE POLICY "Authenticated users can view emails"
  ON emails FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create emails (send/receive)
CREATE POLICY "Authenticated users can create emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admins can delete emails
CREATE POLICY "Admins can delete emails"
  ON emails FOR DELETE
  TO authenticated
  USING (auth.role() = 'admin');

-- Create policies for inventory table
-- All authenticated users can read inventory
CREATE POLICY "Authenticated users can view inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage inventory
CREATE POLICY "Admins can manage inventory"
  ON inventory FOR ALL
  TO authenticated
  USING (auth.role() = 'admin');

-- Create a function to set user role in session
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'user'
  )::text;
$$ LANGUAGE sql STABLE;

-- Create a function to get current user ID
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    NULL
  )::uuid;
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE users IS 'Users with authentication credentials';
COMMENT ON TABLE companies IS 'Companies (RLS enabled - authenticated access only)';
COMMENT ON TABLE leads IS 'Sales leads (RLS enabled - authenticated access only)';
COMMENT ON TABLE emails IS 'Email communications (RLS enabled - authenticated access only)';
COMMENT ON TABLE inventory IS 'Product inventory (RLS enabled - authenticated access only)';
