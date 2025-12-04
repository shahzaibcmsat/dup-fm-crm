import { db, pool } from './server/db';
import { sql } from 'drizzle-orm';

async function checkNotifications() {
  try {
    console.log('🔍 Checking current notifications...\n');
    
    // Get all notifications
    const result = await db.execute(sql`
      SELECT id, lead_id, lead_name, email_id, from_email, subject, is_dismissed, created_at
      FROM notifications
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    const rows = Array.isArray(result) ? result : (result.rows || []);
    
    console.log(`Found ${rows.length} notifications:\n`);
    rows.forEach(row => {
      console.log(`📧 ${row.lead_name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Email ID: ${row.email_id || '❌ NOT LINKED'}`);
      console.log(`   From: ${row.from_email}`);
      console.log(`   Subject: ${row.subject}`);
      console.log(`   Dismissed: ${row.is_dismissed}`);
      console.log(`   Created: ${row.created_at}`);
      console.log('');
    });
    
    // Count by lead
    const counts = await db.execute(sql`
      SELECT lead_name, COUNT(*) as count
      FROM notifications
      WHERE is_dismissed = false
      GROUP BY lead_name
      ORDER BY count DESC
    `);
    
    const countRows = Array.isArray(counts) ? counts : (counts.rows || []);
    
    console.log('\n📊 Count by lead:');
    countRows.forEach(row => {
      console.log(`   ${row.lead_name}: ${row.count}`);
    });
    
    // Check for notifications without email_id
    const noEmailId = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE email_id IS NULL
    `);
    
    const noEmailIdRows = Array.isArray(noEmailId) ? noEmailId : (noEmailId.rows || []);
    console.log(`\n⚠️  Notifications without email_id: ${noEmailIdRows[0]?.count || 0}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkNotifications();
