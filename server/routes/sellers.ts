import { Router, Response } from 'express';
import pool from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Delete a seller and all related data
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify the seller belongs to the authenticated user
    const sellerCheck = await client.query(
      'SELECT id FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );

    if (sellerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Seller not found or access denied' });
    }

    try {
      // Delete related sold_to_transactions first (due to foreign key constraints)
      await client.query(
        'DELETE FROM sold_to_transactions WHERE seller_id = $1',
        [id]
      );

      // Delete related seller_transactions
      await client.query(
        'DELETE FROM seller_transactions WHERE seller_id = $1',
        [id]
      );

      // Delete related sale_to entries
      await client.query(
        'DELETE FROM sale_to WHERE seller_id = $1',
        [id]
      );

      // Finally, delete the seller
      await client.query(
        'DELETE FROM sellers WHERE id = $1',
        [id]
      );
    } catch (error) {
      console.error('Database error during deletion:', error);
      throw error; // This will be caught by the outer catch block
    }

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

// Update a transaction (purchase or advance)
router.put('/:id/transactions/:txnId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id, txnId } = req.params;
  const { 
    transaction_date, 
    amount_added, 
    kg_added, 
    flower_name, 
    salesman_name, 
    salesman_mobile, 
    salesman_address,
    transaction_type
  } = req.body as any;

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
    const seller = sellerCheck.rows[0];

    const txnCheck = await pool.query(
      'SELECT * FROM seller_transactions WHERE id = $1 AND seller_id = $2',
      [txnId, id]
    );
    if (txnCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const oldTxn = txnCheck.rows[0];
    const currentType = transaction_type || oldTxn.transaction_type || 'purchase';

    // Calculate the difference from the old transaction
    const oldAmount = parseFloat(oldTxn.amount_added) || 0;
    const oldKg = parseFloat(oldTxn.kg_added) || 0;
    const newAmount = parseFloat(amount_added) || 0;
    const newKg = parseFloat(kg_added) || 0;
    const amountDiff = newAmount - oldAmount;
    const kgDiff = newKg - oldKg;

    // Update seller with the difference
    const currentAmount = parseFloat(seller.amount) || 0;
    const currentKg = parseFloat(seller.kg) || 0;
    
    // For advance transactions, we allow negative amounts
    const updatedAmount = currentType === 'advance' 
      ? currentAmount + amountDiff  // Can be negative
      : Math.max(0, currentAmount + amountDiff);  // Regular purchases can't be negative
      
    const updatedKg = Math.max(0, currentKg + kgDiff);

    // Only check for negative balance for non-advance transactions
    if (currentType !== 'advance' && (updatedAmount < 0 || updatedKg < 0)) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Update would result in negative balance' });
    }

    await pool.query(
      'UPDATE sellers SET amount = $1, kg = $2, updated_at = NOW() WHERE id = $3',
      [updatedAmount, updatedKg, id]
    );

    // Update transaction
    const result = await pool.query(
      `UPDATE seller_transactions 
       SET transaction_date = $1, 
           amount_added = $2, 
           kg_added = $3, 
           new_total_amount = $4, 
           new_total_kg = $5,
           flower_name = $6,
           salesman_name = $7,
           salesman_mobile = $8,
           salesman_address = $9,
           transaction_type = $10
       WHERE id = $11 AND seller_id = $12
       RETURNING *`,
      [
        transaction_date || oldTxn.transaction_date,
        newAmount,
        newKg,
        updatedAmount,
        updatedKg,
        flower_name !== undefined ? flower_name : oldTxn.flower_name,
        salesman_name !== undefined ? salesman_name : oldTxn.salesman_name,
        salesman_mobile !== undefined ? salesman_mobile : oldTxn.salesman_mobile,
        salesman_address !== undefined ? salesman_address : oldTxn.salesman_address,
        currentType,
        txnId,
        id
      ]
    );

    await pool.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Update transaction error:', error);
    const msg = (error as any)?.message || 'Failed to update transaction';
    // Expose pg error detail for debugging (safe surface)
    const detail = (error as any)?.detail || (error as any)?.hint || undefined;
    res.status(500).json({ error: msg, detail });
  }
});

// Delete a transaction (purchase update)
router.delete('/:id/transactions/:txnId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id, txnId } = req.params;
  const client = await pool.connect();  // Get a client from the pool

  try {
    await client.query('BEGIN');
    console.log(`Starting delete transaction ${txnId} for seller ${id}`);

    // Verify seller exists and belongs to user
    const sellerCheck = await client.query(
      'SELECT * FROM sellers WHERE id = $1 AND owner_id = $2 FOR UPDATE',
      [id, req.userId]
    );
    
    if (sellerCheck.rows.length === 0) {
      console.error('Seller not found or access denied');
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Seller not found' });
    }
    
    const seller = sellerCheck.rows[0];
    console.log('Seller verified:', { sellerId: seller.id, currentAmount: seller.amount, currentKg: seller.kg });

    // Get the transaction to be deleted with FOR UPDATE to lock the row
    const txnCheck = await client.query(
      'SELECT * FROM seller_transactions WHERE id = $1 AND seller_id = $2 FOR UPDATE',
      [txnId, id]
    );
    
    if (txnCheck.rows.length === 0) {
      console.error('Transaction not found');
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const txn = txnCheck.rows[0];
    console.log('Transaction found:', { 
      transactionId: txn.id, 
      amountAdded: txn.amount_added, 
      kgAdded: txn.kg_added,
      transactionType: txn.transaction_type
    });

    // Handle different transaction types
    const transactionType = txn.transaction_type || 'purchase';
    const isAdvance = transactionType === 'advance';

    const transactionAmount = Number(txn.amount_added) || 0;
    const transactionKg = Number(txn.kg_added) || 0;

    const currentAmount = Number(seller.amount) || 0;
    const currentKg = Number(seller.kg) || 0;

    // If there are any payments tied to this transaction, we must reverse them first
    // so that balances remain consistent and to avoid foreign key issues.
    const paymentAgg = await client.query(
      'SELECT COALESCE(SUM(amount),0) AS amt, COALESCE(SUM(cleared_kg),0) AS kg FROM payments WHERE transaction_id = $1',
      [txnId]
    );
    const linkedPaymentAmount = Number(paymentAgg.rows?.[0]?.amt || 0);
    const linkedPaymentKg = Number(paymentAgg.rows?.[0]?.kg || 0);

    // Reverse payments: add back what payments had deducted from seller
    let tempAmount = currentAmount + linkedPaymentAmount;
    let tempKg = currentKg + linkedPaymentKg;

    // Now remove the transaction itself (or add back if it was an advance/negative)
    let newAmount: number;
    let newKg: number;
    if (isAdvance) {
      // For advance deletion, amount_added is typically negative. Removing it means adding back its absolute value.
      newAmount = tempAmount + Math.abs(transactionAmount);
      newKg = tempKg; // kg doesn't change for advances
    } else {
      // For regular purchase deletion, subtract the recorded additions.
      newAmount = Math.max(0, tempAmount - transactionAmount);
      newKg = Math.max(0, tempKg - transactionKg);
    }

    console.log('Calculated values (with payments reversed):', {
      isAdvance,
      currentAmount,
      currentKg,
      linkedPaymentAmount,
      linkedPaymentKg,
      transactionAmount,
      transactionKg,
      newAmount,
      newKg,
      transactionType
    });

    // First delete any linked payments so the transaction delete won't violate FKs
    if (linkedPaymentAmount > 0 || linkedPaymentKg > 0) {
      console.log('Deleting linked payments for transaction:', { txnId, linkedPaymentAmount, linkedPaymentKg });
      await client.query('DELETE FROM payments WHERE transaction_id = $1', [txnId]);
      console.log('Linked payments deleted');
    }

    // Next delete the transaction
    console.log('Deleting transaction...');
    const deleteResult = await client.query(
      'DELETE FROM seller_transactions WHERE id = $1 AND seller_id = $2 RETURNING *',
      [txnId, id]
    );
    
    if (deleteResult.rowCount === 0) {
      throw new Error('Failed to delete transaction - no rows affected');
    }
    console.log('Transaction deleted successfully');

    // Then update the seller with the new amounts
    console.log('Updating seller amounts...');
    const updateResult = await client.query(
      'UPDATE sellers SET amount = $1, kg = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [newAmount, newKg, id]
    );
    
    if (updateResult.rowCount === 0) {
      throw new Error('Failed to update seller amounts - no rows affected');
    }
    console.log('Seller amounts updated successfully');

    await client.query('COMMIT');
    console.log('Transaction committed successfully');
    
    return res.json({ 
      success: true,
      message: 'Transaction deleted successfully',
      newAmount,
      newKg,
      transactionType
    });
  } catch (error) {
    console.error('Error in delete transaction:', {
      error,
      sellerId: id,
      transactionId: txnId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    try {
      await client.query('ROLLBACK');
      console.log('Transaction rolled back');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete transaction';
    return res.status(500).json({ 
      success: false,
      error: 'Failed to delete transaction',
      details: errorMessage,
      sellerId: id,
      transactionId: txnId
    });
  } finally {
    client.release(); // Always release the client back to the pool
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
  const { 
    transaction_date, 
    amount_added, 
    kg_added, 
    flower_name, 
    salesman_name, 
    salesman_mobile, 
    salesman_address,
    transaction_type = 'purchase' // Default to 'purchase' for backward compatibility
  } = req.body as any;

  try {
    await pool.query('BEGIN');

    // Verify seller exists and belongs to user
    const sellerCheck = await pool.query(
      'SELECT * FROM sellers WHERE id = $1 AND owner_id = $2',
      [id, req.userId]
    );
    if (sellerCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Seller not found' });
    }
    const seller = sellerCheck.rows[0];

    // Get current values
    const currentAmount = parseFloat(seller.amount) || 0;
    const currentKg = parseFloat(seller.kg) || 0;

    // Calculate new totals
    const amountToAdd = parseFloat(amount_added) || 0;
    const kgToAdd = parseFloat(kg_added) || 0;
    
    // For advance transactions, we allow negative amounts
    const newAmount = transaction_type === 'advance' 
      ? currentAmount + amountToAdd  // Can be negative
      : Math.max(0, currentAmount + amountToAdd);  // Regular purchases can't be negative
      
    const newKg = Math.max(0, currentKg + kgToAdd);

    // Update seller with new totals
    await pool.query(
      'UPDATE sellers SET amount = $1, kg = $2, updated_at = NOW() WHERE id = $3',
      [newAmount, newKg, id]
    );

    // Add transaction record
    const result = await pool.query(
      `INSERT INTO seller_transactions 
       (seller_id, transaction_date, amount_added, kg_added, previous_amount, previous_kg, 
        new_total_amount, new_total_kg, flower_name, salesman_name, salesman_mobile, 
        salesman_address, transaction_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        transaction_date || new Date().toISOString().split('T')[0],
        amountToAdd,
        kgToAdd,
        currentAmount,
        currentKg,
        newAmount,
        newKg,
        flower_name,
        salesman_name,
        salesman_mobile,
        salesman_address,
        transaction_type
      ]
    );

    await pool.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
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
