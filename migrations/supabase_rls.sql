-- ============================================
-- Supabase Row Level Security (RLS) Setup
-- ============================================
-- This migration enables RLS on all tables and creates policies
-- that work with Supabase Auth (auth.uid())

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ============================================
-- COMPANIES TABLE POLICIES
-- ============================================

-- Allow authenticated users to view all companies
CREATE POLICY "Authenticated users can view companies"
ON companies FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create companies
CREATE POLICY "Authenticated users can create companies"
ON companies FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update companies
CREATE POLICY "Authenticated users can update companies"
ON companies FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete companies
CREATE POLICY "Authenticated users can delete companies"
ON companies FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- LEADS TABLE POLICIES
-- ============================================

-- Allow authenticated users to view all leads
CREATE POLICY "Authenticated users can view leads"
ON leads FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create leads
CREATE POLICY "Authenticated users can create leads"
ON leads FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update leads
CREATE POLICY "Authenticated users can update leads"
ON leads FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete leads
CREATE POLICY "Authenticated users can delete leads"
ON leads FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- EMAILS TABLE POLICIES
-- ============================================

-- Allow authenticated users to view all emails
CREATE POLICY "Authenticated users can view emails"
ON emails FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create emails
CREATE POLICY "Authenticated users can create emails"
ON emails FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update emails
CREATE POLICY "Authenticated users can update emails"
ON emails FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete emails
CREATE POLICY "Authenticated users can delete emails"
ON emails FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- INVENTORY TABLE POLICIES
-- ============================================

-- Allow authenticated users to view all inventory
CREATE POLICY "Authenticated users can view inventory"
ON inventory FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create inventory
CREATE POLICY "Authenticated users can create inventory"
ON inventory FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update inventory
CREATE POLICY "Authenticated users can update inventory"
ON inventory FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete inventory
CREATE POLICY "Authenticated users can delete inventory"
ON inventory FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

COMMENT ON TABLE companies IS 'RLS enabled - authenticated users only';
COMMENT ON TABLE leads IS 'RLS enabled - authenticated users only';
COMMENT ON TABLE emails IS 'RLS enabled - authenticated users only';
COMMENT ON TABLE inventory IS 'RLS enabled - authenticated users only';
