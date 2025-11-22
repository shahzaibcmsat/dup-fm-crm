-- Add companyId column to leads table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN company_id VARCHAR REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
