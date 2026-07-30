DROP TRIGGER IF EXISTS `update_novel_stats`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `update_novel_stats_on_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `update_novel_stats_on_delete`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__migration_Novel` AS SELECT * FROM `Novel`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__migration_Chapter` AS SELECT * FROM `Chapter`;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `__migration_NovelCategory` AS SELECT * FROM `NovelCategory`;--> statement-breakpoint
DROP TABLE IF EXISTS `__new_Novel`;--> statement-breakpoint
CREATE TABLE `__new_Novel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`pluginId` text NOT NULL,
	`name` text NOT NULL,
	`cover` text,
	`summary` text,
	`author` text,
	`artist` text,
	`status` text DEFAULT 'Unknown',
	`genres` text,
	`inLibrary` integer DEFAULT false,
	`isLocal` integer DEFAULT false,
	`totalPages` integer DEFAULT 0,
	`chaptersDownloaded` integer DEFAULT 0,
	`chaptersUnread` integer DEFAULT 0,
	`totalChapters` integer DEFAULT 0,
	`lastReadAt` text,
	`lastUpdatedAt` text
);
--> statement-breakpoint
INSERT INTO `__new_Novel` (
	`id`,
	`path`,
	`pluginId`,
	`name`,
	`cover`,
	`summary`,
	`author`,
	`artist`,
	`status`,
	`genres`,
	`inLibrary`,
	`isLocal`,
	`totalPages`,
	`chaptersDownloaded`,
	`chaptersUnread`,
	`totalChapters`,
	`lastReadAt`,
	`lastUpdatedAt`
)
SELECT
	`__migration_Novel`.`id`,
	`__migration_Novel`.`path`,
	`__migration_Novel`.`pluginId`,
	`__migration_Novel`.`name`,
	`__migration_Novel`.`cover`,
	`__migration_Novel`.`summary`,
	`__migration_Novel`.`author`,
	`__migration_Novel`.`artist`,
	`__migration_Novel`.`status`,
	`__migration_Novel`.`genres`,
	`__migration_Novel`.`inLibrary`,
	`__migration_Novel`.`isLocal`,
	`__migration_Novel`.`totalPages`,
	(
		SELECT COUNT(*)
		FROM `__migration_Chapter`
		WHERE `__migration_Chapter`.`novelId` = `__migration_Novel`.`id`
			AND `__migration_Chapter`.`isDownloaded` = 1
	),
	(
		SELECT COUNT(*)
		FROM `__migration_Chapter`
		WHERE `__migration_Chapter`.`novelId` = `__migration_Novel`.`id`
			AND `__migration_Chapter`.`unread` = 1
	),
	(
		SELECT COUNT(*)
		FROM `__migration_Chapter`
		WHERE `__migration_Chapter`.`novelId` = `__migration_Novel`.`id`
	),
	(
		SELECT MAX(`__migration_Chapter`.`readTime`)
		FROM `__migration_Chapter`
		WHERE `__migration_Chapter`.`novelId` = `__migration_Novel`.`id`
	),
	(
		SELECT MAX(`__migration_Chapter`.`updatedTime`)
		FROM `__migration_Chapter`
		WHERE `__migration_Chapter`.`novelId` = `__migration_Novel`.`id`
	)
FROM `__migration_Novel`;--> statement-breakpoint
DELETE FROM `NovelCategory`;--> statement-breakpoint
DELETE FROM `Chapter`;--> statement-breakpoint
DROP TABLE IF EXISTS `Novel`;--> statement-breakpoint
ALTER TABLE `__new_Novel` RENAME TO `Novel`;--> statement-breakpoint
INSERT OR REPLACE INTO `Chapter` (
	`id`,
	`novelId`,
	`path`,
	`name`,
	`releaseTime`,
	`bookmark`,
	`unread`,
	`readTime`,
	`isDownloaded`,
	`updatedTime`,
	`chapterNumber`,
	`page`,
	`position`,
	`progress`,
	`scanlator`,
	`timeSpent`
)
SELECT
	`id`,
	`novelId`,
	`path`,
	`name`,
	`releaseTime`,
	`bookmark`,
	`unread`,
	`readTime`,
	`isDownloaded`,
	`updatedTime`,
	`chapterNumber`,
	`page`,
	`position`,
	`progress`,
	`scanlator`,
	`timeSpent`
FROM `__migration_Chapter`;--> statement-breakpoint
INSERT OR REPLACE INTO `NovelCategory` SELECT * FROM `__migration_NovelCategory`;--> statement-breakpoint
DROP TABLE `__migration_Novel`;--> statement-breakpoint
DROP TABLE `__migration_Chapter`;--> statement-breakpoint
DROP TABLE `__migration_NovelCategory`;--> statement-breakpoint
CREATE UNIQUE INDEX `novel_path_plugin_unique` ON `Novel` (`path`,`pluginId`);--> statement-breakpoint
CREATE INDEX `NovelIndex` ON `Novel` (`pluginId`,`path`,`id`,`inLibrary`);
