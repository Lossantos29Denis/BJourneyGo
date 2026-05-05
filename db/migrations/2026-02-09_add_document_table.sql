-- Create Document table if missing
CREATE TABLE IF NOT EXISTS `Document` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agency_id` INT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` ENUM('POLITICAS','MANUALES','RECURSOS') NOT NULL DEFAULT 'RECURSOS',
  `description` TEXT NULL,
  `file_url` TEXT NULL,
  `file_size` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Document'
    AND INDEX_NAME = 'idx_document_agency_category'
);

SET @ddl_idx := IF(@idx_exists = 0,
  'CREATE INDEX `idx_document_agency_category` ON `Document` (`agency_id`, `category`)',
  'SELECT 1'
);

PREPARE stmt_idx FROM @ddl_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;
