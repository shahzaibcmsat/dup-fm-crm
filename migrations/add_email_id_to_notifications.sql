-- Add email_id column to notifications table for accurate tracking
-- Each notification now links to a specific email
-- CASCADE ensures notifications are automatically deleted when email is deleted

-- Add the email_id column
ALTER TABLE notifications
ADD COLUMN email_id VARCHAR;

-- Add foreign key constraint with CASCADE delete
ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_email
FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE;

-- Create index for performance on email_id lookups
CREATE INDEX idx_notifications_email_id ON notifications(email_id);

-- Optional: Clear existing notifications since they won't have email_id
-- Uncomment if you want a clean start:
-- DELETE FROM notifications;
