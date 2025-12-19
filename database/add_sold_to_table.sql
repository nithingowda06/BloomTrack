-- Create sold_to_transactions table to track sales
CREATE TABLE IF NOT EXISTS sold_to_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT,
  sale_date DATE NOT NULL,
  kg_sold DECIMAL(10, 2) NOT NULL,
  amount_sold DECIMAL(10, 2) NOT NULL,
  previous_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  previous_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  remaining_kg DECIMAL(10, 2) NOT NULL,
  remaining_amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sold_to_seller_id ON sold_to_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_sold_to_date ON sold_to_transactions(sale_date);
CREATE INDEX IF NOT EXISTS idx_sold_to_customer ON sold_to_transactions(customer_name);
