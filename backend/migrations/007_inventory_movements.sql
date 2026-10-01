BEGIN;

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    kind VARCHAR(20) NOT NULL,
    quantity_delta NUMERIC(12, 3) NOT NULL,
    note VARCHAR(500),
    actor_telegram_id BIGINT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_inventory_movements_product_id
ON inventory_movements (product_id);

CREATE INDEX IF NOT EXISTS ix_inventory_movements_order_id
ON inventory_movements (order_id);

CREATE INDEX IF NOT EXISTS ix_inventory_movements_created_at
ON inventory_movements (created_at);

COMMIT;
