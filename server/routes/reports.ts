import { Router, Response, Request } from 'express';
import pool from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/reports/eod?date=YYYY-MM-DD
// For the authenticated owner, aggregate seller_transactions on that date
// grouped by seller, summing kg_added and amount_added
router.get('/eod', authenticateToken, async (req: AuthRequest, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

  try {
    const result = await pool.query(
      `SELECT 
         s.id as seller_id,
         s.serial_number,
         s.name,
         s.mobile,
         COALESCE(SUM(st.kg_added), 0) as total_kg,
         COALESCE(SUM(st.amount_added), 0) as total_amount
       FROM sellers s
       LEFT JOIN seller_transactions st ON st.seller_id = s.id AND st.transaction_date = $2
       WHERE s.owner_id = $1
       GROUP BY s.id, s.serial_number, s.name, s.mobile
       ORDER BY s.serial_number ASC, s.name ASC`,
      [req.userId, date]
    );

    // Also compute overall totals
    const totals = result.rows.reduce(
      (acc, r) => {
        acc.total_kg += Number(r.total_kg || 0);
        acc.total_amount += Number(r.total_amount || 0);
        return acc;
      },
      { total_kg: 0, total_amount: 0 }
    );

    res.json({ date, rows: result.rows, totals });
  } catch (err: any) {
    console.error('EOD report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
