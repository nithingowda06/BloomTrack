-- Migration: Add seller_transactions table for transaction history
-- Run this in Neon SQL Editor

-- Create seller_transactions table to track history
CREATE TABLE IF NOT EXISTS seller_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  amount_added DECIMAL(10, 2) NOT NULL,
  kg_added DECIMAL(10, 2) NOT NULL,
  previous_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  previous_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  new_total_amount DECIMAL(10, 2) NOT NULL,
  new_total_kg DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_seller_transactions_seller_id ON seller_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_transactions_date ON seller_transactions(transaction_date);
