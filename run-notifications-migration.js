import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in .env file');
  }

  console.log('🔗 Connecting to database...');
  const pool = new Pool({ connectionString });

  try {
    // Read the migration file
    const migrationSQL = readFileSync(
      join(__dirname, 'migrations', 'add_notifications_table.sql'),
      'utf-8'
    );

    console.log('🔄 Running notifications table migration...');
    
    // Set search path to public schema
    await pool.query('SET search_path TO public');
    
    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Created notifications table with indexes');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
