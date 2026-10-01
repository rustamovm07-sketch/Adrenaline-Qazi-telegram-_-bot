-- =========================================================
-- ADRENALIN QAZI
-- Migration: Order Landmark
-- File: backend/migrations/002_order_landmark.sql
-- =========================================================

BEGIN;

-- =========================================================
-- ORDER DELIVERY LANDMARK
-- =========================================================
--
-- Bu maydon aynan BUYURTMA uchun saqlanadi.
--
-- Customer.landmark:
--     mijozning asosiy profil orientiri
--
-- Order.landmark:
--     aynan shu buyurtma uchun ishlatilgan orientir
--
-- Shu sababli mijoz keyinchalik profilini o'zgartirsa,
-- eski buyurtmaning orientiri o'zgarmaydi.
-- =========================================================

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS landmark VARCHAR(1000);

COMMIT;