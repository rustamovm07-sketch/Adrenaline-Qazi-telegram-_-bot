BEGIN;

CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    actor_telegram_id BIGINT,
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_order_status_history_order_id
ON order_status_history (order_id);

ALTER TABLE order_status_history
ALTER COLUMN created_at SET DEFAULT NOW();

INSERT INTO order_status_history (order_id, previous_status, new_status, note)
SELECT orders.id, NULL, orders.status, 'Amaldagi holat migration paytida yozib olindi.'
FROM orders
WHERE NOT EXISTS (
    SELECT 1
    FROM order_status_history AS history
    WHERE history.order_id = orders.id
);

COMMIT;
