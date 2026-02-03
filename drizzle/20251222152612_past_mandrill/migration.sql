CREATE TABLE IF NOT EXISTS `Category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `category_name_unique` ON `Category` (`name`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `category_sort_idx` ON `Category` (`sort`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Chapter` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novelId` integer NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`releaseTime` text,
	`bookmark` integer DEFAULT false,
	`unread` integer DEFAULT true,
	`readTime` text,
	`isDownloaded` integer DEFAULT false,
	`updatedTime` text,
	`chapterNumber` real,
	`page` text DEFAULT '1',
	`position` integer DEFAULT 0,
	`progress` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `chapter_novel_path_unique` ON `Chapter` (`novelId`,`path`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chapterNovelIdIndex` ON `Chapter` (`novelId`,`position`,`page`,`id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Novel` (
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
CREATE UNIQUE INDEX IF NOT EXISTS `novel_path_plugin_unique` ON `Novel` (`path`,`pluginId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `NovelIndex` ON `Novel` (`pluginId`,`path`,`id`,`inLibrary`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `NovelCategory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`novelId` integer NOT NULL,
	`categoryId` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `novel_category_unique` ON `NovelCategory` (`novelId`,`categoryId`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Repository` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `repository_url_unique` ON `Repository` (`url`);
