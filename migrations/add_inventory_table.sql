-- Drop old inventory table if exists
DROP TABLE IF EXISTS inventory;

-- Create inventory table with new structure
CREATE TABLE IF NOT EXISTS inventory (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  product_heading TEXT,
  product TEXT NOT NULL,
  boxes INTEGER,
  sq_ft_per_box TEXT,
  total_sq_ft TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on product for faster searches
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product);

-- Create index on product_heading for filtering
CREATE INDEX IF NOT EXISTS idx_inventory_heading ON inventory(product_heading);
