-- Create CalendarEvent table if missing
CREATE TABLE IF NOT EXISTS `CalendarEvent` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `agency_id` INT NULL,
  `event_type` ENUM('APPOINTMENT') NOT NULL DEFAULT 'APPOINTMENT',
  `title` VARCHAR(255) NOT NULL,
  `start_at` DATETIME NOT NULL,
  `end_at` DATETIME NULL,
  `details` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_calendar_event_user_start` ON `CalendarEvent` (`user_id`, `start_at`);
CREATE INDEX `idx_calendar_event_agency_start` ON `CalendarEvent` (`agency_id`, `start_at`);
