import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Delete a seller and all related transactions
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId;

  if (!id) {
    return res.status(400).json({ error: 'Seller ID is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify the seller belongs to the authenticated user
    const sellerCheck = await client.query(
      `SELECT s.* FROM sellers s 
       JOIN profiles p ON s.owner_id = p.id 
       WHERE s.id = $1 AND p.id = $2`,
      [id, userId]
    );

    if (sellerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Seller not found or access denied' });
    }

    // Delete related transactions first (due to foreign key constraints)
    await client.query(
      'DELETE FROM sold_to_transactions WHERE seller_id = $1',
      [id]
    );

    await client.query(
      'DELETE FROM seller_transactions WHERE seller_id = $1',
      [id]
    );

    // Finally, delete the seller
    await client.query(
      'DELETE FROM sellers WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Seller and all related data deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting seller:', error);
    res.status(500).json({ error: 'Failed to delete seller' });
  } finally {
    client.release();
  }
});

// Delete a sold_to_transaction
router.delete('/sold-to/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId;

  if (!id) {
    return res.status(400).json({ error: 'Transaction ID is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify the transaction belongs to a seller owned by the authenticated user
    const transactionCheck = await client.query(
      `SELECT st.* 
       FROM sold_to_transactions st
       JOIN sellers s ON st.seller_id = s.id
       JOIN profiles p ON s.owner_id = p.id
       WHERE st.id = $1 AND p.id = $2`,
      [id, userId]
    );

    if (transactionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found or access denied' });
    }

    // Get the transaction details before deleting
    const transaction = transactionCheck.rows[0];
    
    // Delete the transaction
    await client.query(
      'DELETE FROM sold_to_transactions WHERE id = $1',
      [id]
    );

    // Update the seller's remaining amount and kg
    await client.query(
      `UPDATE sellers 
       SET amount = amount + $1,
           kg = kg + $2
       WHERE id = $3`,
      [transaction.amount_sold, transaction.kg_sold, transaction.seller_id]
    );

    // Log this action in seller_transactions
    await client.query(
      `INSERT INTO seller_transactions (
        seller_id, 
        transaction_date, 
        amount_added, 
        kg_added, 
        previous_amount, 
        previous_kg, 
        new_total_amount, 
        new_total_kg
      ) VALUES (
        $1, 
        NOW(), 
        $2, 
        $3, 
        $4, 
        $5, 
        $6, 
        $7
      )`,
      [
        transaction.seller_id,
        transaction.amount_sold,
        transaction.kg_sold,
        transaction.previous_amount,
        transaction.previous_kg,
        transaction.previous_amount + transaction.amount_sold,
        transaction.previous_kg + transaction.kg_sold
      ]
    );

    await client.query('COMMIT');
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  } finally {
    client.release();
  }
});

export default router;
