-- Drop existing table if it exists to start fresh
DROP TABLE IF EXISTS notifications CASCADE;

-- Create notifications table for storing email notifications
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  lead_id VARCHAR NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_notifications_lead_id ON notifications(lead_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_dismissed ON notifications(is_dismissed);

-- Auto-cleanup old dismissed notifications (older than 7 days)
-- This keeps the table size manageable
CREATE OR REPLACE FUNCTION cleanup_old_dismissed_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE is_dismissed = true
  AND dismissed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
