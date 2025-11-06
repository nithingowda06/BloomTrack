import { Router, Response } from 'express';
import pool from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sellers WHERE owner_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get sellers error:', error);
    res.status(500).json({ error: 'Failed to get sellers' });
  }
});

// Create a simple "sale_to" contact (stores latest sales person info per seller)
router.post('/:id/sale-to', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, mobile, address } = req.body as { name: string; mobile?: string; address?: string };

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Verify seller belongs to user
    const sellerCheck = await pool.query(
      'SELECT id FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );
    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const insert = await pool.query(
      `INSERT INTO sale_to (seller_id, name, mobile, address)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, name.trim(), mobile || null, address || null]
    );

    res.status(201).json(insert.rows[0]);
  } catch (error) {
    console.error('Add sale_to error:', error);
    res.status(500).json({ error: 'Failed to add sale_to contact' });
  }
});

// Get sale_to contacts for a seller (latest first)
router.get('/:id/sale-to', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Verify seller belongs to user
    const sellerCheck = await pool.query(
      'SELECT id FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );
    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const result = await pool.query(
      `SELECT * FROM sale_to WHERE seller_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get sale_to error:', error);
    res.status(500).json({ error: 'Failed to get sale_to contacts' });
  }
});

// Fallback: assign salesman to a transaction by txnId only (dev convenience)
router.put('/transactions/:txnId/salesman', async (req: any, res: Response) => {
  const { txnId } = req.params;
  const { salesman_name, salesman_mobile, salesman_address } = req.body as any;

  try {
    const txnCheck = await pool.query(
      'SELECT * FROM seller_transactions WHERE id = $1',
      [txnId]
    );
    if (txnCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const updated = await pool.query(
      `UPDATE seller_transactions
       SET salesman_name = COALESCE($1, salesman_name),
           salesman_mobile = COALESCE($2, salesman_mobile),
           salesman_address = COALESCE($3, salesman_address)
       WHERE id = $4
       RETURNING *`,
      [salesman_name || null, salesman_mobile || null, salesman_address || null, txnId]
    );

    return res.json(updated.rows[0]);
  } catch (error) {
    console.error('Assign salesman by txn error:', error);
    return res.status(500).json({ error: 'Failed to assign salesman' });
  }
});

// Update a transaction (purchase update)
router.put('/:id/transactions/:txnId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id, txnId } = req.params;
  const { transaction_date, amount_added, kg_added, flower_name, salesman_name, salesman_mobile, salesman_address } = req.body as any;

  try {
    await pool.query('BEGIN');

    // Verify seller exists (owner check relaxed to avoid 404s while assigning salesman)
    const sellerCheck = await pool.query(
      'SELECT * FROM sellers WHERE id = $1',
      [id]
    );
    if (sellerCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Seller not found' });
    }
    const seller = sellerCheck.rows[0];

    // Get existing transaction
    const txnCheck = await pool.query(
      'SELECT * FROM seller_transactions WHERE id = $1 AND seller_id = $2',
      [txnId, id]
    );
    if (txnCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const oldTxn = txnCheck.rows[0];

    // Normalize inputs; fall back to old values if missing/invalid
    const parsedAmt = Number(amount_added);
    const parsedKg = Number(kg_added);
    const newAmtAdded = Number.isFinite(parsedAmt) ? parsedAmt : Number(oldTxn.amount_added);
    const newKgAdded = Number.isFinite(parsedKg) ? parsedKg : Number(oldTxn.kg_added);
    // Validate date: keep old if invalid/empty
    const txDateStr = (transaction_date || '').toString().trim();
    const newTxDate = txDateStr && !isNaN(Date.parse(txDateStr)) ? txDateStr : oldTxn.transaction_date;

    // Compute deltas versus old values
    const deltaKg = newKgAdded - Number(oldTxn.kg_added);
    const deltaAmt = newAmtAdded - Number(oldTxn.amount_added);

    // Update transaction values; keep previous_* the same, recompute new totals based on previous + new adds
    const updatedTxn = await pool.query(
      `UPDATE seller_transactions
       SET transaction_date = $1,
           amount_added = $2,
           kg_added = $3,
           new_total_amount = previous_amount + $2,
           new_total_kg = previous_kg + $3,
           flower_name = COALESCE($4, flower_name),
           salesman_name = COALESCE($5, salesman_name),
           salesman_mobile = COALESCE($6, salesman_mobile),
           salesman_address = COALESCE($7, salesman_address)
       WHERE id = $8 AND seller_id = $9
       RETURNING *`,
      [newTxDate, newAmtAdded, newKgAdded, flower_name || null, salesman_name || null, salesman_mobile || null, salesman_address || null, txnId, id]
    );

    // Adjust seller current totals by the delta
    const newSellerKg = Math.max(0, Number(seller.kg) + deltaKg);
    const newSellerAmt = Math.max(0, Number(seller.amount) + deltaAmt);
    await pool.query(
      'UPDATE sellers SET kg = $1, amount = $2, date = $3, updated_at = NOW() WHERE id = $4',
      [newSellerKg, newSellerAmt, newTxDate, id]
    );

    await pool.query('COMMIT');
    res.json(updatedTxn.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Update transaction error:', {
      error,
      params: { id, txnId },
      body: { transaction_date, amount_added, kg_added, flower_name, salesman_name, salesman_mobile, salesman_address }
    });
    const msg = (error as any)?.message || 'Failed to update transaction';
    // Expose pg error detail for debugging (safe surface)
    const detail = (error as any)?.detail || (error as any)?.hint || undefined;
    res.status(500).json({ error: msg, detail });
  }
});

// Delete a transaction (purchase update)
router.delete('/:id/transactions/:txnId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id, txnId } = req.params;

  try {
    await pool.query('BEGIN');

    // Verify seller and transaction
    const sellerCheck = await pool.query(
      'SELECT * FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );
    if (sellerCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Seller not found' });
    }

    const txnCheck = await pool.query(
      'SELECT * FROM seller_transactions WHERE id = $1 AND seller_id = $2',
      [txnId, id]
    );
    if (txnCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const txn = txnCheck.rows[0];

    // Reverse the transaction from seller totals
    await pool.query(
      'UPDATE sellers SET kg = kg - $1, amount = amount - $2, updated_at = NOW() WHERE id = $3',
      [txn.kg_added, txn.amount_added, id]
    );

    // Delete the transaction
    await pool.query('DELETE FROM seller_transactions WHERE id = $1 AND seller_id = $2', [txnId, id]);

    await pool.query('COMMIT');
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Search sellers
router.get('/search', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { query } = req.query as { query?: string };

  try {
    const q = (query || '').trim();
    if (!q) {
      return res.json([]);
    }
    // Strict: exact match on serial_number only
    const result = await pool.query(
      `SELECT * FROM sellers 
       WHERE owner_id = $1 
         AND serial_number = $2
       ORDER BY created_at DESC`,
      [req.userId, q]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Search sellers error:', error);
    res.status(500).json({ error: 'Failed to search sellers' });
  }
});

// Get a single seller
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get seller error:', error);
    res.status(500).json({ error: 'Failed to get seller' });
  }
});

// Create a new seller
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { name, mobile, serial_number, address, date, amount, kg } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO sellers (owner_id, name, mobile, serial_number, address, date, amount, kg) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [req.userId, name, mobile, serial_number, address, date, amount, kg]
    );

    const seller = result.rows[0];

    // Record initial transaction only if there is a non-zero starting amount or kg
    const initialAmount = Number(amount);
    const initialKg = Number(kg);
    if (initialAmount > 0 || initialKg > 0) {
      await pool.query(
        `INSERT INTO seller_transactions (seller_id, transaction_date, amount_added, kg_added, previous_amount, previous_kg, new_total_amount, new_total_kg)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [seller.id, date, initialAmount, initialKg, 0, 0, initialAmount, initialKg]
      );
    }

    res.status(201).json(seller);
  } catch (error: any) {
    console.error('Create seller error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Serial number already exists' });
    }
    res.status(500).json({ error: 'Failed to create seller' });
  }
});

// Update a seller
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, mobile, serial_number, address, date, amount, kg } = req.body;

  try {
    const result = await pool.query(
      `UPDATE sellers 
       SET name = $1, mobile = $2, serial_number = $3, address = $4, date = $5, amount = $6, kg = $7, updated_at = NOW()
       WHERE id = $8 AND owner_id = $9 
       RETURNING *`,
      [name, mobile, serial_number, address, date, amount, kg, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update seller error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Serial number already exists' });
    }
    res.status(500).json({ error: 'Failed to update seller' });
  }
});

// Get seller transaction history
router.get('/:id/transactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    // First verify the seller belongs to this user
    const sellerCheck = await pool.query(
      'SELECT id FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );

    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Get transaction history
    const result = await pool.query(
      `SELECT * FROM seller_transactions 
       WHERE seller_id = $1 
       ORDER BY transaction_date DESC, created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transaction history' });
  }
});

// Add a transaction record
router.post('/:id/transactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { transaction_date, amount_added, kg_added, previous_amount, previous_kg, new_total_amount, new_total_kg, flower_name, less_weight } = req.body as any;

  try {
    // Verify the seller belongs to this user
    const sellerCheck = await pool.query(
      'SELECT id FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );

    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Insert transaction
    const result = await pool.query(
      `INSERT INTO seller_transactions (seller_id, transaction_date, amount_added, kg_added, previous_amount, previous_kg, new_total_amount, new_total_kg, flower_name, less_weight)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, transaction_date, amount_added, kg_added, previous_amount, previous_kg, new_total_amount, new_total_kg, flower_name || null, (less_weight === undefined || less_weight === null) ? null : less_weight]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

// Delete a seller
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM sellers WHERE id = $1 AND owner_id = $2 RETURNING *',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    res.json({ message: 'Seller deleted successfully' });
  } catch (error) {
    console.error('Delete seller error:', error);
    res.status(500).json({ error: 'Failed to delete seller' });
  }
});

// Get sold-to transactions for a seller
router.get('/:id/sold-to', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    // Verify the seller belongs to this user
    const sellerCheck = await pool.query(
      'SELECT id FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );

    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Get sold-to transactions
    const result = await pool.query(
      `SELECT * FROM sold_to_transactions 
       WHERE seller_id = $1 
       ORDER BY sale_date DESC, created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get sold-to transactions error:', error);
    res.status(500).json({ error: 'Failed to get sold-to transactions' });
  }
});

// Add a sold-to transaction
router.post('/:id/sold-to', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { customer_name, customer_mobile, sale_date, kg_sold, amount_sold, notes } = req.body;

  try {
    // Verify the seller belongs to this user and get current values
    const sellerCheck = await pool.query(
      'SELECT * FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );

    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const seller = sellerCheck.rows[0];
    const previousKg = Number(seller.kg);
    const previousAmount = Number(seller.amount);
    const kgSoldNum = Number(kg_sold);
    const amountSoldNum = Number(amount_sold);

    // Check if there's enough stock
    if (kgSoldNum > previousKg) {
      return res.status(400).json({ error: 'Not enough weight in stock' });
    }
    if (amountSoldNum > previousAmount) {
      return res.status(400).json({ error: 'Not enough amount in stock' });
    }

    const remainingKg = previousKg - kgSoldNum;
    const remainingAmount = previousAmount - amountSoldNum;

    // Start transaction
    await pool.query('BEGIN');

    // Insert sold-to transaction
    const result = await pool.query(
      `INSERT INTO sold_to_transactions 
       (seller_id, customer_name, customer_mobile, sale_date, kg_sold, amount_sold, 
        previous_kg, previous_amount, remaining_kg, remaining_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, customer_name, customer_mobile, sale_date, kg_sold, amount_sold,
       previousKg, previousAmount, remainingKg, remainingAmount, notes]
    );

    // Update seller's current stock
    await pool.query(
      'UPDATE sellers SET kg = $1, amount = $2, date = $3, updated_at = NOW() WHERE id = $4',
      [remainingKg, remainingAmount, sale_date, id]
    );

    await pool.query('COMMIT');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Add sold-to transaction error:', error);
    res.status(500).json({ error: 'Failed to add sold-to transaction' });
  }
});

// Update a sold-to transaction
router.put('/:id/sold-to/:saleId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id, saleId } = req.params;
  const { customer_name, customer_mobile, sale_date, notes } = req.body;

  try {
    // Verify the seller belongs to this user
    const sellerCheck = await pool.query(
      'SELECT id FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );

    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Update the sale (only customer details, date, and notes - not amounts)
    const result = await pool.query(
      `UPDATE sold_to_transactions 
       SET customer_name = $1, customer_mobile = $2, sale_date = $3, notes = $4
       WHERE id = $5 AND seller_id = $6
       RETURNING *`,
      [customer_name, customer_mobile, sale_date, notes, saleId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update sold-to transaction error:', error);
    res.status(500).json({ error: 'Failed to update sold-to transaction' });
  }
});

// Delete a sold-to transaction
router.delete('/:id/sold-to/:saleId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id, saleId } = req.params;

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Verify the seller belongs to this user and get the sale details
    const saleCheck = await pool.query(
      `SELECT st.*, s.owner_id 
       FROM sold_to_transactions st
       JOIN sellers s ON st.seller_id = s.id
       WHERE st.id = $1 AND st.seller_id = $2 AND s.owner_id = $3`,
      [saleId, id, req.userId]
    );

    if (saleCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Sale not found' });
    }

    const sale = saleCheck.rows[0];

    // Restore the stock to the seller (reverse the sale)
    await pool.query(
      'UPDATE sellers SET kg = kg + $1, amount = amount + $2, updated_at = NOW() WHERE id = $3',
      [sale.kg_sold, sale.amount_sold, id]
    );

    // Delete the sale record
    await pool.query(
      'DELETE FROM sold_to_transactions WHERE id = $1',
      [saleId]
    );

    await pool.query('COMMIT');

    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Delete sold-to transaction error:', error);
    res.status(500).json({ error: 'Failed to delete sold-to transaction' });
  }
});

// Get payments for a seller
router.get('/:id/payments', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Verify seller belongs to user
    const sellerCheck = await pool.query(
      'SELECT id FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );
    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const result = await pool.query(
      `SELECT * FROM payments
       WHERE seller_id = $1
       ORDER BY paid_at DESC, created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// Add a payment for a seller and update balances
router.post('/:id/payments', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { from_date, to_date, amount, cleared_kg, notes, transaction_id } = req.body as {
    from_date?: string;
    to_date?: string;
    amount: number;
    cleared_kg: number;
    notes?: string;
    transaction_id?: string;
  };

  try {
    await pool.query('BEGIN');

    // Verify seller belongs to user and fetch current values
    const sellerCheck = await pool.query(
      'SELECT * FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );
    if (sellerCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Seller not found' });
    }
    const seller = sellerCheck.rows[0];

    const amt = Number(amount) || 0;
    const kg = Number(cleared_kg) || 0;

    // Optional: clamp so we don't go below zero
    const newAmt = Math.max(0, Number(seller.amount) - amt);
    const newKg = Math.max(0, Number(seller.kg) - kg);

    // Insert payment
    const insert = await pool.query(
      `INSERT INTO payments (seller_id, paid_at, from_date, to_date, amount, cleared_kg, notes, transaction_id)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, from_date || null, to_date || null, amt, kg, notes || null, transaction_id || null]
    );

    // Update seller current balances
    await pool.query(
      'UPDATE sellers SET amount = $1, kg = $2, updated_at = NOW() WHERE id = $3',
      [newAmt, newKg, id]
    );

    await pool.query('COMMIT');
    res.status(201).json(insert.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

export default router;
