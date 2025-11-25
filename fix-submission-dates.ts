import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function fixSubmissionDates() {
  try {
    console.log('🔧 Fixing submission dates for existing leads...\n');
    
    // Update shah's lead (6/11/2025 = Excel serial 45819)
    const shahDate = new Date(1899, 11, 30);
    shahDate.setDate(shahDate.getDate() + 45819);
    
    await db.execute(sql`
      UPDATE leads 
      SET submission_date = ${shahDate.toISOString()}
      WHERE email = 'imshazz23@gmail.com'
    `);
    console.log(`✅ Updated shah - Submission Date: ${shahDate.toISOString()}`);
    
    // Update shahzaib's lead (6/2/2025 = Excel serial 45810)
    const shahzaibDate = new Date(1899, 11, 30);
    shahzaibDate.setDate(shahzaibDate.getDate() + 45810);
    
    await db.execute(sql`
      UPDATE leads 
      SET submission_date = ${shahzaibDate.toISOString()}
      WHERE email = 'shazzkapco@gmail.com'
    `);
    console.log(`✅ Updated shahzaib - Submission Date: ${shahzaibDate.toISOString()}`);
    
    // Verify the updates
    const leads = await db.execute(sql`
      SELECT client_name, email, submission_date 
      FROM leads 
      WHERE email IN ('imshazz23@gmail.com', 'shazzkapco@gmail.com')
      ORDER BY submission_date DESC
    `);
    
    console.log('\n📊 Verification:');
    for (const lead of leads.rows) {
      console.log(`   ${lead.client_name}: ${lead.submission_date || 'NULL'}`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('🔄 Refresh your browser to see the updated dates.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixSubmissionDates();
