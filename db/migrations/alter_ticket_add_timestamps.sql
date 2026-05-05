-- Migration: alter_ticket_add_timestamps.sql
-- Adds created_at/updated_at to Ticket, ensures issued_at exists,
-- fills missing uuid/issued_at for existing rows, and creates trigger
-- to auto-populate uuid, issued_at, created_at and updated_at on insert.
--
-- Usage: execute this file against the BJourneyGo database, e.g.:
--   mysql -h <host> -P <port> -u <user> -p < db/migrations/alter_ticket_add_timestamps.sql

-- 1) Optional backup of Ticket table (uncomment to run)
-- CREATE TABLE IF NOT EXISTS `Ticket_backup` AS SELECT * FROM `Ticket`;

-- 2) Add columns (if not present)
SET @has_created_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Ticket'
    AND COLUMN_NAME = 'created_at'
);

SET @ddl_created_at := IF(@has_created_at = 0,
  'ALTER TABLE `Ticket` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);

PREPARE stmt_created_at FROM @ddl_created_at;
EXECUTE stmt_created_at;
DEALLOCATE PREPARE stmt_created_at;

SET @has_updated_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Ticket'
    AND COLUMN_NAME = 'updated_at'
);

SET @ddl_updated_at := IF(@has_updated_at = 0,
  'ALTER TABLE `Ticket` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);

PREPARE stmt_updated_at FROM @ddl_updated_at;
EXECUTE stmt_updated_at;
DEALLOCATE PREPARE stmt_updated_at;

SET @has_issued_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Ticket'
    AND COLUMN_NAME = 'issued_at'
);

SET @ddl_issued_at := IF(@has_issued_at = 0,
  'ALTER TABLE `Ticket` ADD COLUMN `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);

PREPARE stmt_issued_at FROM @ddl_issued_at;
EXECUTE stmt_issued_at;
DEALLOCATE PREPARE stmt_issued_at;

-- 3) Fill missing values in existing rows
UPDATE `Ticket` SET `uuid` = UUID() WHERE (`uuid` IS NULL OR `uuid` = '') AND `id` IS NOT NULL;
UPDATE `Ticket` SET `issued_at` = NOW() WHERE `issued_at` IS NULL AND `id` IS NOT NULL;

-- 4) Create trigger to auto-fill fields on insert
DROP TRIGGER IF EXISTS `trg_ticket_before_insert`;
DELIMITER $$
CREATE TRIGGER `trg_ticket_before_insert` BEFORE INSERT ON `Ticket`
FOR EACH ROW
BEGIN
  IF NEW.uuid IS NULL OR NEW.uuid = '' THEN
    SET NEW.uuid = UUID();
  END IF;
  IF NEW.issued_at IS NULL THEN
    SET NEW.issued_at = NOW();
  END IF;
  IF NEW.created_at IS NULL THEN
    SET NEW.created_at = NOW();
  END IF;
  SET NEW.updated_at = NOW();
END$$
DELIMITER ;

-- 5) Optional checks (uncomment to run)
-- SHOW CREATE TABLE `Ticket`;
-- SHOW TRIGGERS LIKE 'trg_ticket_before_insert';
-- SELECT COUNT(*) AS ticket_count FROM `Ticket`;
