import 'dotenv/config';
import { pool } from './db';

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running migration: add email tracking columns...');
    
    await client.query(`
      ALTER TABLE emails 
      ADD COLUMN IF NOT EXISTS message_id TEXT,
      ADD COLUMN IF NOT EXISTS conversation_id TEXT,
      ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
      ADD COLUMN IF NOT EXISTS from_email TEXT,
      ADD COLUMN IF NOT EXISTS to_email TEXT
    `);
    
    console.log('✅ Added columns to emails table');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
      CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON emails(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    `);
    
    console.log('✅ Created indexes');
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
