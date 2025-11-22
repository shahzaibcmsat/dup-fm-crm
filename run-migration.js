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
      join(__dirname, 'migrations', '0000_thankful_domino.sql'),
      'utf-8'
    );

    console.log('🔄 Running migration...');
    
    // Set search path to public schema
    await pool.query('SET search_path TO public');
    
    // Split by statement breakpoint and execute each statement
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      console.log('📝 Executing statement...');
      await pool.query(statement);
    }

    console.log('✅ Migration completed successfully!');
    console.log('📊 Created tables: companies, leads, emails, inventory');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
