import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Per-chapter translation cache: one row per (novel, chapter, provider,
 * languages). Mirrors the Chapter table's composite key on (novelId, path).
 */
export const chapterTranslation = sqliteTable(
  'chapter_translation',
  {
    novelId: integer('novelId').notNull(),
    path: text('path').notNull(),
    provider: text('provider').notNull(),
    sourceLanguage: text('sourceLanguage').notNull(),
    targetLanguage: text('targetLanguage').notNull(),
    /** JSON.stringify of the translated paragraph texts (parallel to source). */
    paragraphs: text('paragraphs').notNull(),
    updatedTime: text('updatedTime'),
  },
  table => [
    uniqueIndex('chapter_translation_key_unique').on(
      table.novelId,
      table.path,
      table.provider,
      table.sourceLanguage,
      table.targetLanguage,
    ),
    index('chapterTranslationNovelIdIndex').on(table.novelId),
  ],
);

export type ChapterTranslationRow = typeof chapterTranslation.$inferSelect;
export type ChapterTranslationInsert = typeof chapterTranslation.$inferInsert;
