import { Router, Response } from 'express';
import pool from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all sellers for the authenticated user
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

// Search sellers
router.get('/search', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { query } = req.query;

  try {
    const result = await pool.query(
      `SELECT * FROM sellers 
       WHERE owner_id = $1 
       AND serial_number = $2
       ORDER BY created_at DESC`,
      [req.userId, query]
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

    // Record initial transaction
    await pool.query(
      `INSERT INTO seller_transactions (seller_id, transaction_date, amount_added, kg_added, previous_amount, previous_kg, new_total_amount, new_total_kg)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [seller.id, date, amount, kg, 0, 0, amount, kg]
    );

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
  const { transaction_date, amount_added, kg_added, previous_amount, previous_kg, new_total_amount, new_total_kg } = req.body;

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
      `INSERT INTO seller_transactions (seller_id, transaction_date, amount_added, kg_added, previous_amount, previous_kg, new_total_amount, new_total_kg)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, transaction_date, amount_added, kg_added, previous_amount, previous_kg, new_total_amount, new_total_kg]
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

export default router;
