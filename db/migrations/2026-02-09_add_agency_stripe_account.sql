-- Add stripe_account_id to Agency if missing
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Agency'
    AND COLUMN_NAME = 'stripe_account_id'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `Agency` ADD COLUMN `stripe_account_id` VARCHAR(255) NULL AFTER `address`',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
