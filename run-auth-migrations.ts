// Run authentication migrations
// Usage: npx tsx run-auth-migrations.ts

import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration(filename: string) {
  console.log(`\n📄 Running migration: ${filename}`);
  
  const migrationPath = path.join(process.cwd(), 'migrations', filename);
  
  if (!fs.existsSync(migrationPath)) {
    console.log(`❌ Migration file not found: ${migrationPath}`);
    return false;
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  try {
    await db.execute(sql.raw(migrationSQL));
    console.log(`✅ Successfully ran migration: ${filename}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error running migration ${filename}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log('   Running Authentication Migrations');
  console.log('═══════════════════════════════════════════\n');

  // Run migrations in order
  const migrations = [
    'add_users_table.sql',
    // Note: enable_rls.sql should be run manually in Supabase dashboard
    // or with proper admin credentials as it requires elevated permissions
  ];

  let successCount = 0;
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) successCount++;
  }

  console.log('\n═══════════════════════════════════════════');
  console.log(`✅ Completed ${successCount}/${migrations.length} migrations`);
  console.log('═══════════════════════════════════════════\n');

  if (successCount === migrations.length) {
    console.log('🎉 All migrations completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Add SESSION_SECRET to your .env file');
    console.log('2. (Optional) Run enable_rls.sql in Supabase SQL Editor for RLS');
    console.log('3. Restart the server: npm run dev');
    console.log('4. Login with:');
    console.log('   - Admin: username=Admin, password=Admin@123');
    console.log('   - Client: username=FMD, password=FMD@123');
  } else {
    console.log('⚠️ Some migrations failed. Please check the errors above.');
  }

  process.exit(successCount === migrations.length ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
