import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

const leads = await db.execute(sql`
  SELECT id, client_name, email, submission_date, created_at 
  FROM leads 
  ORDER BY created_at DESC 
  LIMIT 3
`);

console.log(JSON.stringify(leads.rows, null, 2));
