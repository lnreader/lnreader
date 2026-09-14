CREATE TABLE `chapter_translation` (
	`novelId` integer NOT NULL,
	`path` text NOT NULL,
	`provider` text NOT NULL,
	`sourceLanguage` text NOT NULL,
	`targetLanguage` text NOT NULL,
	`paragraphs` text NOT NULL,
	`updatedTime` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_translation_key_unique` ON `chapter_translation` (`novelId`,`path`,`provider`,`sourceLanguage`,`targetLanguage`);--> statement-breakpoint
CREATE INDEX `chapterTranslationNovelIdIndex` ON `chapter_translation` (`novelId`);