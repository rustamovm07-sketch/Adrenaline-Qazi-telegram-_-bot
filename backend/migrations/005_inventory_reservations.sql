BEGIN;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS reserved_stock_units NUMERIC(12, 3)
NOT NULL DEFAULT 0;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMP WITHOUT TIME ZONE;

CREATE INDEX IF NOT EXISTS ix_orders_reservation_expires_at
ON orders (reservation_expires_at);

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS stock_units_reserved NUMERIC(12, 3)
NOT NULL DEFAULT 0;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS reservation_released BOOLEAN
NOT NULL DEFAULT FALSE;

COMMIT;
