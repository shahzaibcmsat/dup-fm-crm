-- Add references column to emails table for proper email threading
-- This stores the full chain of Message-IDs for threading across all email clients
-- Note: "references" is quoted because it's a reserved keyword in PostgreSQL

ALTER TABLE emails ADD COLUMN IF NOT EXISTS "references" TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN emails."references" IS 'Full chain of Message-IDs for email threading (RFC 5322 compliant)';
