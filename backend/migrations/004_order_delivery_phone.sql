BEGIN;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(30);

UPDATE orders AS orders_table
SET delivery_phone = customers.phone
FROM customers
WHERE orders_table.customer_id = customers.id
  AND orders_table.delivery_phone IS NULL;

COMMIT;
