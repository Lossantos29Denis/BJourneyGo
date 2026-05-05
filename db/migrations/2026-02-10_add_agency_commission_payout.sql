-- Migration: add commission and payout fields to Agency
ALTER TABLE `Agency`
  ADD COLUMN `commission_percent` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN `payout_active` TINYINT(1) NOT NULL DEFAULT 1;
