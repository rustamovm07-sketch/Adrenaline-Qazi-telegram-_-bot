-- =========================================================
-- ADRENALIN QAZI
-- Migration: Customer Profile
-- File: backend/migrations/001_customer_profile.sql
-- =========================================================

BEGIN;

-- =========================================================
-- CUSTOMER PROFILE FIELDS
-- =========================================================

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS surname VARCHAR(100);

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);

-- =========================================================
-- DEFAULT DELIVERY LOCATION
-- =========================================================

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS landmark VARCHAR(1000);

-- =========================================================
-- PROFILE COMPLETION
-- =========================================================

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN
    NOT NULL
    DEFAULT FALSE;

-- =========================================================
-- SAFETY / INDEX
-- =========================================================

CREATE INDEX IF NOT EXISTS ix_customers_profile_completed
ON customers (profile_completed);

COMMIT;