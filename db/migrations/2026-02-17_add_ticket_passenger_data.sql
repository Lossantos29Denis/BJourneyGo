-- Add passenger identity fields per ticket and pre-payment passenger storage per order

SET @has_order_reference_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'reference_code'
);
SET @sql := IF(
  @has_order_reference_code = 0,
  'ALTER TABLE `Order` ADD COLUMN `reference_code` VARCHAR(20) NULL AFTER `user_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @order_user_id_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'user_id'
  LIMIT 1
);
SET @sql := IF(
  @order_user_id_nullable = 'NO',
  'ALTER TABLE `Order` MODIFY COLUMN `user_id` INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_order_contact_email := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'contact_email'
);
SET @sql := IF(
  @has_order_contact_email = 0,
  'ALTER TABLE `Order` ADD COLUMN `contact_email` VARCHAR(255) NULL AFTER `reference_code`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_order_contact_phone := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'contact_phone'
);
SET @sql := IF(
  @has_order_contact_phone = 0,
  'ALTER TABLE `Order` ADD COLUMN `contact_phone` VARCHAR(32) NULL AFTER `contact_email`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_uq_order_reference_code := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'uq_order_reference_code'
);
SET @sql := IF(
  @has_uq_order_reference_code = 0,
  'CREATE UNIQUE INDEX `uq_order_reference_code` ON `Order` (`reference_code`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_order_contact_email := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'idx_order_contact_email'
);
SET @sql := IF(
  @has_idx_order_contact_email = 0,
  'CREATE INDEX `idx_order_contact_email` ON `Order` (`contact_email`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_order_contact_phone := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'idx_order_contact_phone'
);
SET @sql := IF(
  @has_idx_order_contact_phone = 0,
  'CREATE INDEX `idx_order_contact_phone` ON `Order` (`contact_phone`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_passenger_name := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Ticket' AND COLUMN_NAME = 'passenger_name'
);
SET @sql := IF(
  @has_passenger_name = 0,
  'ALTER TABLE `Ticket` ADD COLUMN `passenger_name` VARCHAR(120) NULL AFTER `trip_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_passenger_identification := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Ticket' AND COLUMN_NAME = 'passenger_identification'
);
SET @sql := IF(
  @has_passenger_identification = 0,
  'ALTER TABLE `Ticket` ADD COLUMN `passenger_identification` VARCHAR(64) NULL AFTER `passenger_name`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_passenger_phone := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Ticket' AND COLUMN_NAME = 'passenger_phone'
);
SET @sql := IF(
  @has_passenger_phone = 0,
  'ALTER TABLE `Ticket` ADD COLUMN `passenger_phone` VARCHAR(32) NULL AFTER `passenger_identification`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_is_contact := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Ticket' AND COLUMN_NAME = 'is_contact'
);
SET @sql := IF(
  @has_is_contact = 0,
  'ALTER TABLE `Ticket` ADD COLUMN `is_contact` TINYINT(1) NOT NULL DEFAULT 0 AFTER `passenger_phone`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_ticket_order_identity := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Ticket' AND INDEX_NAME = 'idx_ticket_order_identity'
);
SET @sql := IF(
  @has_idx_ticket_order_identity = 0,
  'CREATE INDEX `idx_ticket_order_identity` ON `Ticket` (`order_id`, `passenger_identification`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `OrderPassenger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `passenger_index` INT NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `identification` VARCHAR(64) NOT NULL,
  `phone` VARCHAR(32) NULL,
  `is_contact` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY `uq_order_passenger_order_idx` (`order_id`, `passenger_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_idx_order_passenger_order := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OrderPassenger' AND INDEX_NAME = 'idx_order_passenger_order'
);
SET @sql := IF(
  @has_idx_order_passenger_order = 0,
  'CREATE INDEX `idx_order_passenger_order` ON `OrderPassenger` (`order_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
