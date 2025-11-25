import pkg from 'pg';
const { Pool } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔄 Running lead assignment migration...');
    
    const migrationSQL = readFileSync(
      join(__dirname, 'migrations', 'add_lead_assignment.sql'),
      'utf8'
    );
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
