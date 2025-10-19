-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles table for owner details
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sellers table
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  address TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sellers_owner_id ON sellers(owner_id);
CREATE INDEX IF NOT EXISTS idx_sellers_serial_number ON sellers(serial_number);
CREATE INDEX IF NOT EXISTS idx_sellers_name ON sellers(name);
CREATE INDEX IF NOT EXISTS idx_sellers_mobile ON sellers(mobile);

-- Ensure serial_number is unique per owner (not globally)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_owner_serial ON sellers (owner_id, serial_number);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sellers_updated_at
  BEFORE UPDATE ON sellers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_seller_transactions_seller_id ON seller_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_transactions_date ON seller_transactions(transaction_date);

-- Ensure pgcrypto extension exists for gen_random_uuid()
-- Note: Requires sufficient privileges; in Neon, enable in the project if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create sold_to_transactions table used by sellers routes
CREATE TABLE IF NOT EXISTS sold_to_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT,
  sale_date DATE NOT NULL,
  kg_sold DECIMAL(10, 2) NOT NULL,
  amount_sold DECIMAL(10, 2) NOT NULL,
  previous_kg DECIMAL(10, 2) NOT NULL,
  previous_amount DECIMAL(10, 2) NOT NULL,
  remaining_kg DECIMAL(10, 2) NOT NULL,
  remaining_amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sold_to_transactions
CREATE INDEX IF NOT EXISTS idx_sold_to_transactions_seller_id ON sold_to_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_sold_to_transactions_date ON sold_to_transactions(sale_date);

