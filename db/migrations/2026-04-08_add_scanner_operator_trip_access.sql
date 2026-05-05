CREATE TABLE IF NOT EXISTS `ScannerOperatorTripAccess` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `operator_user_id` INT NOT NULL,
  `trip_id` INT NOT NULL,
  `agency_id` INT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by_user_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_scanner_operator_trip` (`operator_user_id`, `trip_id`),
  INDEX `idx_scanner_operator_user_active` (`operator_user_id`, `active`),
  INDEX `idx_scanner_operator_trip_active` (`trip_id`, `active`),
  FOREIGN KEY (`operator_user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`trip_id`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
