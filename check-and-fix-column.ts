import { db, pool } from './server/db';
import { sql } from 'drizzle-orm';

async function checkAndAddColumn() {
  try {
    console.log('🔍 Checking if email_id column exists...');
    
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'notifications' AND column_name = 'email_id'
    `);
    
    const rows = Array.isArray(result) ? result : (result.rows || []);
    
    if (rows.length > 0) {
      console.log('✅ Column email_id already exists');
    } else {
      console.log('❌ Column email_id does not exist. Adding it now...');
      
      // Add column
      await db.execute(sql`ALTER TABLE notifications ADD COLUMN email_id VARCHAR`);
      console.log('✅ Added email_id column');
      
      // Add foreign key
      await db.execute(sql`
        ALTER TABLE notifications
        ADD CONSTRAINT fk_notifications_email
        FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
      `);
      console.log('✅ Added foreign key constraint');
      
      // Create index
      await db.execute(sql`CREATE INDEX idx_notifications_email_id ON notifications(email_id)`);
      console.log('✅ Created index on email_id');
    }
    
    // Show table structure
    console.log('\n📋 Current notifications table structure:');
    const columns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `);
    const columnRows = Array.isArray(columns) ? columns : (columns.rows || []);
    columnRows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkAndAddColumn();
