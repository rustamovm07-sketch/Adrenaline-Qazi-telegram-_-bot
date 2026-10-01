-- =========================================================
-- ADRENALIN QAZI
-- Migration: Verify Order Landmark
-- File: backend/migrations/003_verify_order_landmark.sql
-- =========================================================

BEGIN;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS landmark VARCHAR(1000);

COMMIT;