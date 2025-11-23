-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Insert default admin user (password: Admin@123)
-- Password hash is bcrypt hash of "Admin@123"
INSERT INTO users (username, email, password_hash, role)
VALUES (
  'Admin',
  'admin@fmdcompanies.com',
  '$2b$10$oQYX8ItpdaytVZ4C5zlgZ.A1HrRePPeiJCIkDqj75tangQdEBmIE2',
  'admin'
) ON CONFLICT (username) DO NOTHING;

-- Insert default client user (password: FMD@123)
INSERT INTO users (username, email, password_hash, role)
VALUES (
  'FMD',
  'client@fmdcompanies.com',
  '$2b$10$4j2UlHujKShPCJu8qkJjjuKlBgsdp8.LVUCLvBnZHKB4WtNe8mnY2',
  'user'
) ON CONFLICT (username) DO NOTHING;
