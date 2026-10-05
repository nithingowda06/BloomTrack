import { Router, Response, Request } from 'express';
import pool from '../db.js';

const router = Router();

// Temporary migration endpoint: make serial_number unique per owner
router.post('/migrate-owner-serial', async (req: Request, res: Response) => {
  try {
    await pool.query('BEGIN');

    // Drop existing UNIQUE constraints on sellers (likely the one on serial_number)
    const constraints = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.sellers'::regclass
        AND contype = 'u'
    `);

    for (const row of constraints.rows) {
      const conname = row.conname as string;
      await pool.query(`ALTER TABLE public.sellers DROP CONSTRAINT ${conname}`);
    }

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_owner_serial
      ON public.sellers (owner_id, serial_number)
    `);

    await pool.query('COMMIT');
    return res.json({ status: 'ok', message: 'Migration applied: uniq_owner_serial set on (owner_id, serial_number)' });
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch {}
    console.error('Admin migration error:', err);
    return res.status(500).json({ error: 'Migration failed', details: (err as Error).message });
  }
});

// Simple DB ping: SELECT 1
router.get('/ping', async (req: Request, res: Response) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, result: r.rows[0] });
  } catch (err: any) {
    console.error('DB ping error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

// Diagnostics: check DB objects and basic connectivity
router.get('/db-inspect', async (req: Request, res: Response) => {
  try {
    const usersTable = await pool.query("SELECT to_regclass('public.users') as exists");
    const profilesTable = await pool.query("SELECT to_regclass('public.profiles') as exists");
    const sellersTable = await pool.query("SELECT to_regclass('public.sellers') as exists");
    const uniqOwnerSerial = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='uniq_owner_serial'`
    );

    res.json({
      usersTable: usersTable.rows[0].exists,
      profilesTable: profilesTable.rows[0].exists,
      sellersTable: sellersTable.rows[0].exists,
      hasOwnerScopedIndex: uniqOwnerSerial.rows.length > 0
    });
  } catch (err: any) {
    console.error('DB inspect error:', err);
    res.status(500).json({ error: err.message });
  }
});
