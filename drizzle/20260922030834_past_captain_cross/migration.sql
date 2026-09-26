ALTER TABLE `Chapter` ADD `pagePosition` integer DEFAULT 0;--> statement-breakpoint
UPDATE `Chapter` SET `pagePosition` = `position`;--> statement-breakpoint
WITH ranked AS (
	SELECT
		`id`,
		ROW_NUMBER() OVER (
			PARTITION BY `novelId`
			ORDER BY CAST(`page` AS INTEGER) ASC, `pagePosition` ASC
		) - 1 AS `rn`
	FROM `Chapter`
)
UPDATE `Chapter` SET `position` = ranked.`rn`
FROM ranked
WHERE `Chapter`.`id` = ranked.`id` AND `Chapter`.`position` IS NOT ranked.`rn`;
