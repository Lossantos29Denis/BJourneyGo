ALTER TABLE `Route`
  DROP FOREIGN KEY `fk_route_agency`;

ALTER TABLE `Route`
  MODIFY `agency_id` INT NULL;

ALTER TABLE `Route`
  ADD CONSTRAINT `fk_route_agency`
  FOREIGN KEY (`agency_id`) REFERENCES `Agency`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
