-- Scanner sessions for trip-scoped QR validation
CREATE TABLE IF NOT EXISTS `ScannerSession` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `agency_worker_id` INT NULL,
  `agency_id` INT NULL,
  `trip_id` INT NOT NULL,
  `access_code` VARCHAR(16) NOT NULL,
  `status` ENUM('ACTIVE','CLOSED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NULL,
  `ended_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`agency_worker_id`) REFERENCES `AgencyWorker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`trip_id`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @idx_scanner_user_status := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ScannerSession' AND INDEX_NAME = 'idx_scanner_session_user_status'
);
SET @ddl_scanner_user_status := IF(
  @idx_scanner_user_status = 0,
  'CREATE INDEX `idx_scanner_session_user_status` ON `ScannerSession` (`user_id`, `status`)',
  'SELECT 1'
);
PREPARE stmt_scanner_user_status FROM @ddl_scanner_user_status;
EXECUTE stmt_scanner_user_status;
DEALLOCATE PREPARE stmt_scanner_user_status;

SET @idx_scanner_trip_status := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ScannerSession' AND INDEX_NAME = 'idx_scanner_session_trip_status'
);
SET @ddl_scanner_trip_status := IF(
  @idx_scanner_trip_status = 0,
  'CREATE INDEX `idx_scanner_session_trip_status` ON `ScannerSession` (`trip_id`, `status`)',
  'SELECT 1'
);
PREPARE stmt_scanner_trip_status FROM @ddl_scanner_trip_status;
EXECUTE stmt_scanner_trip_status;
DEALLOCATE PREPARE stmt_scanner_trip_status;

SET @idx_scanner_access_code := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ScannerSession' AND INDEX_NAME = 'idx_scanner_session_access_code'
);
SET @ddl_scanner_access_code := IF(
  @idx_scanner_access_code = 0,
  'CREATE INDEX `idx_scanner_session_access_code` ON `ScannerSession` (`access_code`)',
  'SELECT 1'
);
PREPARE stmt_scanner_access_code FROM @ddl_scanner_access_code;
EXECUTE stmt_scanner_access_code;
DEALLOCATE PREPARE stmt_scanner_access_code;
