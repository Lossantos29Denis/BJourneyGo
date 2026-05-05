-- Schema initialization for BJourneyGo (MySQL)
-- Run: mysql -u user -p < db/schema_init.sql  OR execute in your MySQL client

CREATE DATABASE IF NOT EXISTS `BJourneyGo` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `BJourneyGo`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Users
CREATE TABLE IF NOT EXISTS `User` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255),
  `phone` VARCHAR(50),
  `role` ENUM('USER','AGENCY_ADMIN','AGENCY_WORKER','ADMIN') NOT NULL DEFAULT 'USER',
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agencies
CREATE TABLE IF NOT EXISTS `Agency` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `tax_id` VARCHAR(100),
  `contact_email` VARCHAR(255),
  `phone` VARCHAR(50),
  `address` JSON,
  `stripe_account_id` VARCHAR(255),
  `commission_percent` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `payout_active` TINYINT(1) NOT NULL DEFAULT 1,
  `status` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_agency_tax_id` (`tax_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agency workers (link between user and agency)
CREATE TABLE IF NOT EXISTS `AgencyWorker` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `agency_id` INT NOT NULL,
  `role` ENUM('MANAGER','STAFF') NOT NULL DEFAULT 'STAFF',
  `scanner_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Shifts (calendar)
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

CREATE INDEX `idx_shift_agency_date` ON `Shift` (`agency_id`, `shift_date`);
CREATE INDEX `idx_shift_user_date` ON `Shift` (`user_id`, `shift_date`);

-- Documents
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

CREATE INDEX `idx_document_agency_category` ON `Document` (`agency_id`, `category`);

-- System configuration
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

-- Calendar events (appointments)
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

-- Routes
CREATE TABLE IF NOT EXISTS `Route` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL,
  `agency_id` INT NULL,
  `origin` VARCHAR(255) NOT NULL,
  `destination` VARCHAR(255) NOT NULL,
  `distance_km` DOUBLE,
  `duration_minutes` INT,
  `status` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_route_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `Route` ADD CONSTRAINT `fk_route_agency` FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `idx_route_origin_destination` ON `Route` (`origin`, `destination`);

-- Buses
CREATE TABLE IF NOT EXISTS `Bus` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agency_id` INT NOT NULL,
  `plate` VARCHAR(50) NOT NULL,
  `capacity` INT NOT NULL,
  `metadata` JSON,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY `uq_bus_plate` (`plate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trips
CREATE TABLE IF NOT EXISTS `Trip` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `route_id` INT NOT NULL,
  `bus_id` INT NULL,
  `departure_at` DATETIME NOT NULL,
  `arrival_at` DATETIME NOT NULL,
  `status` ENUM('SCHEDULED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'SCHEDULED',
  `capacity` INT NOT NULL,
  `seats_sold` INT NOT NULL DEFAULT 0,
  `base_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`route_id`) REFERENCES `Route`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`bus_id`) REFERENCES `Bus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_trip_route_departure` ON `Trip` (`route_id`, `departure_at`);
CREATE INDEX `idx_trip_status_departure` ON `Trip` (`status`, `departure_at`);

-- Orders
CREATE TABLE IF NOT EXISTS `Order` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `reference_code` VARCHAR(20) NULL,
  `contact_email` VARCHAR(255) NULL,
  `contact_phone` VARCHAR(32) NULL,
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `status` ENUM('PENDING','PAID','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `payment_method` VARCHAR(100),
  `payment_reference` VARCHAR(255),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_order_user` ON `Order` (`user_id`);
CREATE INDEX `idx_order_status_created` ON `Order` (`status`, `created_at`);
CREATE UNIQUE INDEX `uq_order_reference_code` ON `Order` (`reference_code`);
CREATE INDEX `idx_order_contact_email` ON `Order` (`contact_email`);
CREATE INDEX `idx_order_contact_phone` ON `Order` (`contact_phone`);

-- Tickets
CREATE TABLE IF NOT EXISTS `Ticket` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `order_id` INT NOT NULL,
  `trip_id` INT NOT NULL,
  `passenger_name` VARCHAR(120) NULL,
  `passenger_identification` VARCHAR(64) NULL,
  `passenger_phone` VARCHAR(32) NULL,
  `is_contact` TINYINT(1) NOT NULL DEFAULT 0,
  `seat_number` VARCHAR(10) NULL,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('ACTIVE','USED','REFUNDED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `expires_at` DATETIME NULL,
  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` DATETIME NULL,
  `verified_by_id` INT NULL,
  `qr_token` TEXT NULL,
  `verification_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`trip_id`) REFERENCES `Trip`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`verified_by_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_ticket_trip_status_expires` ON `Ticket` (`trip_id`, `status`, `expires_at`);
CREATE INDEX `idx_ticket_status_verified` ON `Ticket` (`status`, `verified_at`);
CREATE INDEX `idx_ticket_order_identity` ON `Ticket` (`order_id`, `passenger_identification`);

-- Per-order passenger data (captured before payment confirmation)
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

CREATE INDEX `idx_order_passenger_order` ON `OrderPassenger` (`order_id`);

-- Trigger: ensure uuid and issued_at are set on insert
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

-- Payment records
CREATE TABLE IF NOT EXISTS `PaymentRecord` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `provider` VARCHAR(100) NOT NULL,
  `provider_ref` VARCHAR(255),
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('PENDING','AUTHORIZED','CAPTURED','REFUNDED','FAILED') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `captured_at` DATETIME NULL,
  `refunded_at` DATETIME NULL,
  FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY `uq_payment_provider_ref` (`provider_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX `idx_payment_order_status` ON `PaymentRecord` (`order_id`, `status`);

-- Verification logs
CREATE TABLE IF NOT EXISTS `VerificationLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id` INT NOT NULL,
  `checked_by_user_id` INT NULL,
  `agency_worker_id` INT NULL,
  `result` ENUM('OK','INVALID','ALREADY_USED') NOT NULL,
  `checked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `device_info` JSON,
  `location` JSON,
  FOREIGN KEY (`ticket_id`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`checked_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`agency_worker_id`) REFERENCES `AgencyWorker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Scanner sessions by trip (used by mobile/web QR operators)
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
  FOREIGN KEY (`trip_id`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_scanner_session_user_status` (`user_id`, `status`),
  INDEX `idx_scanner_session_trip_status` (`trip_id`, `status`),
  INDEX `idx_scanner_session_access_code` (`access_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Scanner operator allowed trips (explicit access control by trip)
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

-- Audit
CREATE TABLE IF NOT EXISTS `Audit` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(255) NOT NULL,
  `details` JSON,
  `ip_address` VARCHAR(64),
  `user_agent` VARCHAR(255),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Email tokens (verification / reset) for revocation and audit
CREATE TABLE IF NOT EXISTS `EmailToken` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `jti` VARCHAR(255) NOT NULL UNIQUE,
  `user_id` INT NOT NULL,
  `purpose` ENUM('VERIFY_EMAIL','RESET_PASSWORD') NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `used_at` DATETIME NULL,
  `revoked` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Email verification audit log
CREATE TABLE IF NOT EXISTS `EmailVerificationLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `email` VARCHAR(255) NULL,
  `token_jti` VARCHAR(128) NULL,
  `verified_at` DATETIME NOT NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Refresh tokens for long-lived sessions
CREATE TABLE IF NOT EXISTS `RefreshToken` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `jti` VARCHAR(255) NOT NULL UNIQUE,
  `user_id` INT NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Blacklist for revoked access tokens (jti)
CREATE TABLE IF NOT EXISTS `AccessTokenBlacklist` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `jti` VARCHAR(255) NOT NULL UNIQUE,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
