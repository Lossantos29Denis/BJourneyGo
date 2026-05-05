ALTER TABLE `AgencyWorker`
  ADD COLUMN `scanner_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `role`;
