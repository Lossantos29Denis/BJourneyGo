-- Create SystemConfig table if missing
CREATE TABLE IF NOT EXISTS `SystemConfig` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `scope` ENUM('GLOBAL','AGENCY') NOT NULL DEFAULT 'GLOBAL',
  `agency_id` INT NULL,
  `config_key` VARCHAR(100) NOT NULL,
  `config_value` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_system_config` (`scope`, `agency_id`, `config_key`),
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
