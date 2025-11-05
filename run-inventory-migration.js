import { db } from './server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running inventory schema migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'update_inventory_schema.sql'),
      'utf-8'
    );
    
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Inventory schema migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
