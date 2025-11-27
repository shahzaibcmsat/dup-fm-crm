-- Add performance indexes for frequently queried columns
-- This will significantly speed up database queries

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_submission_date ON leads(submission_date DESC);

-- Emails table indexes
CREATE INDEX IF NOT EXISTS idx_emails_lead_id ON emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON emails(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);

-- Composite index for common email queries
CREATE INDEX IF NOT EXISTS idx_emails_lead_sent ON emails(lead_id, sent_at DESC);

-- Companies table indexes
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- Inventory table indexes
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at DESC);

-- Notifications table indexes (if exists)
-- CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
-- CREATE INDEX IF NOT EXISTS idx_notifications_is_dismissed ON notifications(is_dismissed);
-- CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
