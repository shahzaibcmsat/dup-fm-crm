import 'dotenv/config';
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  try {
    console.log("Running submission date migration...");
    
    await db.execute(sql`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS submission_date TIMESTAMP;
    `);
    
    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
