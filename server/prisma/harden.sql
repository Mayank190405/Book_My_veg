
-- 1. Prevent negative stock
ALTER TABLE "Inventory" 
DROP CONSTRAINT IF EXISTS "inventory_currentstock_check";

ALTER TABLE "Inventory" 
ADD CONSTRAINT "inventory_currentstock_check" 
CHECK ("currentStock" >= 0);

-- 2. Prevent negative credit limit
ALTER TABLE "CustomerKhata" 
DROP CONSTRAINT IF EXISTS "khata_creditlimit_check";

ALTER TABLE "CustomerKhata" 
ADD CONSTRAINT "khata_creditlimit_check" 
CHECK ("creditLimit" >= 0);
