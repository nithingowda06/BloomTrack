-- Add transaction_type column to seller_transactions
ALTER TABLE seller_transactions 
ADD COLUMN IF NOT EXISTS transaction_type TEXT 
DEFAULT 'purchase' 
CHECK (transaction_type IN ('purchase', 'advance'));

-- Update existing transactions to set their type (all existing transactions will be marked as 'purchase')
UPDATE seller_transactions 
SET transaction_type = 'purchase' 
WHERE transaction_type IS NULL;
