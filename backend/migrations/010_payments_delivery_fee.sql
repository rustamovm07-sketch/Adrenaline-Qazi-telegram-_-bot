BEGIN;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL DEFAULT 'hamyon',
    provider_payment_id VARCHAR(255) UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    provider_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'UZS',
    status VARCHAR(20) NOT NULL DEFAULT 'CREATING',
    card_number_encrypted TEXT,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    paid_at TIMESTAMP WITHOUT TIME ZONE,
    cancelled_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS ix_payments_provider_payment_id ON payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS ix_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS ix_payments_expires_at ON payments(expires_at);
CREATE INDEX IF NOT EXISTS ix_payments_created_at ON payments(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_open_provider_amount
    ON payments(provider_amount)
    WHERE status IN ('CREATING', 'PENDING', 'PROCESSING');

COMMIT;
