import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "@shared/schema";

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure postgres client for Supabase pooler connection
export const pool = postgres(connectionString, {
  max: 20, // Maximum number of connections in the pool
  idle_timeout: 30, // Close idle connections after 30s
  connect_timeout: 10, // Timeout for new connections after 10s
  ssl: 'require', // Required for Supabase connections
});

export const db = drizzle(pool, { schema });
