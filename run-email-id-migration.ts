import { db, pool } from './server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Running email_id migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(process.cwd(), 'migrations', 'add_email_id_to_notifications.sql'),
      'utf8'
    );
    
    // Split by semicolons and run each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 100) + '...');
      await db.execute(sql.raw(statement));
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 Changes applied:');
    console.log('   - Added email_id column to notifications table');
    console.log('   - Added foreign key constraint with CASCADE delete');
    console.log('   - Created index on email_id for better performance');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigration();
