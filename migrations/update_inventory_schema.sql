-- Update inventory table schema to match Excel sheet structure
-- Drop existing inventory table if exists
DROP TABLE IF EXISTS inventory CASCADE;

-- Create new inventory table with Excel column structure
CREATE TABLE inventory (
  id SERIAL PRIMARY KEY,
  product TEXT NOT NULL,
  boxes TEXT,
  sq_ft_per_box TEXT,
  total_sq_ft TEXT,
  product_heading TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_inventory_product ON inventory(product);
CREATE INDEX idx_inventory_product_heading ON inventory(product_heading);
