import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();

// Sanitize and validate DATABASE_URL
const RAW_DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_URL = RAW_DATABASE_URL ? RAW_DATABASE_URL.replace(/^['"]|['"]$/g, '') : undefined;

if (!DATABASE_URL || DATABASE_URL.includes('your_neon_postgresql_connection_string_here')) {
  console.error('\n❌ ERROR: DATABASE_URL is not configured in .env file');
  console.error('Please follow these steps:');
  console.error('1. Create a Neon PostgreSQL database at https://console.neon.tech/');
  console.error('2. Copy your connection string');
  console.error('3. Update DATABASE_URL in your .env file');
  console.error('4. Run the database schema from database/schema.sql\n');
  process.exit(1);
}

// Use WebSocket-based driver so it works over HTTPS (443) instead of TCP 5432
neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Fail fast if DB is unreachable
  connectionTimeoutMillis: 5000,
});

// Handle pool errors
pool.on('error', (err: unknown) => {
  console.error('Unexpected database error:', err);
});

export default pool;
