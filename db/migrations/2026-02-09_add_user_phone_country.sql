-- Migration: add phone_country to User (safe for older MySQL versions)
-- This migration checks INFORMATION_SCHEMA and only runs ALTER TABLE when the column is missing.

SET @cnt := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'phone_country');
SET @stmt := IF(@cnt = 0, 'ALTER TABLE `User` ADD COLUMN `phone_country` VARCHAR(8) NULL AFTER `phone`', 'SELECT 0');
PREPARE migrate_stmt FROM @stmt;
EXECUTE migrate_stmt;
DEALLOCATE PREPARE migrate_stmt;

