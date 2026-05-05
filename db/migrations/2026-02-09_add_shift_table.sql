-- Create Shift table if missing
CREATE TABLE IF NOT EXISTS `Shift` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `agency_id` INT NULL,
  `shift_date` DATE NOT NULL,
  `shift_type` ENUM('MORNING','AFTERNOON','NIGHT','REST','VACATION') NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @idx_shift_agency := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Shift'
    AND INDEX_NAME = 'idx_shift_agency_date'
);

SET @ddl_shift_agency := IF(@idx_shift_agency = 0,
  'CREATE INDEX `idx_shift_agency_date` ON `Shift` (`agency_id`, `shift_date`)',
  'SELECT 1'
);

PREPARE stmt_shift_agency FROM @ddl_shift_agency;
EXECUTE stmt_shift_agency;
DEALLOCATE PREPARE stmt_shift_agency;

SET @idx_shift_user := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Shift'
    AND INDEX_NAME = 'idx_shift_user_date'
);

SET @ddl_shift_user := IF(@idx_shift_user = 0,
  'CREATE INDEX `idx_shift_user_date` ON `Shift` (`user_id`, `shift_date`)',
  'SELECT 1'
);

PREPARE stmt_shift_user FROM @ddl_shift_user;
EXECUTE stmt_shift_user;
DEALLOCATE PREPARE stmt_shift_user;
