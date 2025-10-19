import pool from '../db.js';

async function run() {
  try {
    await pool.query('BEGIN');

    // Drop any UNIQUE constraints on sellers (e.g., serial_number global unique)
    const constraints = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.sellers'::regclass
        AND contype = 'u'
    `);

    for (const row of constraints.rows) {
      const conname = row.conname as string;
      console.log(`Dropping unique constraint: ${conname}`);
      await pool.query(`ALTER TABLE public.sellers DROP CONSTRAINT ${conname}`);
    }

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
    // let server pool stay alive if called from server context, but here we can end process
    process.exit(0);
  }
}

run();
