import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Load env
dotenv.config();

// Use WebSocket-based driver (same as server/db.ts)
neonConfig.webSocketConstructor = ws;

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });

  try {
    await pool.query('BEGIN');

    // Find any UNIQUE constraints on sellers (likely the one on serial_number)
    const constraints = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.sellers'::regclass
        AND contype = 'u'
    `);

    for (const row of constraints.rows) {
      const conname = row.conname;
      console.log(`Dropping unique constraint: ${conname}`);
      await pool.query(`ALTER TABLE public.sellers DROP CONSTRAINT ${conname}`);
    }

    // Create composite unique index (owner_id, serial_number)
    console.log('Creating composite unique index uniq_owner_serial on (owner_id, serial_number)...');
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_owner_serial
      ON public.sellers (owner_id, serial_number)
    `);

    await pool.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    try { await pool.query('ROLLBACK'); } catch {}
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
