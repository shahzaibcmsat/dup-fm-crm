-- Add submission_date column to leads table
-- This stores the date when the lead was originally submitted (from import)

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS submission_date TIMESTAMP;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_submission_date ON leads(submission_date);

-- Add comment to column
COMMENT ON COLUMN leads.submission_date IS 'Date when the lead was submitted (from import file)';
