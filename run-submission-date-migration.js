/**
 * Migration Script: Add Submission Date to Leads
 * 
 * This script adds a submission_date column to the leads table
 * to track when a lead was originally submitted (from import files).
 * 
 * Usage:
 * 1. Run the server: npm run dev
 * 2. Make a POST request to: http://localhost:5000/api/migrate/add-submission-date-to-leads
 * 
 * OR use this script:
 * node run-submission-date-migration.js
 */

async function runMigration() {
  try {
    console.log('🔄 Starting submission_date migration...\n');
    
    const response = await fetch('http://localhost:5000/api/migrate/add-submission-date-to-leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log('   Message:', result.message);
      console.log('\n📋 What changed:');
      console.log('   - Added submission_date column to leads table');
      console.log('   - Created index on submission_date for better performance');
      console.log('\n📝 Next steps:');
      console.log('   1. Import leads with "Submission Date" column in Excel');
      console.log('   2. The date will be parsed and stored automatically');
      console.log('   3. View leads to see submission dates displayed');
    } else {
      console.error('❌ Migration failed:', result.message);
    }
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error('\n💡 Make sure the server is running on port 5000');
  }
}

runMigration();
