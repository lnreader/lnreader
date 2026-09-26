import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { chapter } from './chapter';
import { novel } from './novel';

export const restoreChapterMapping = sqliteTable(
  'RestoreChapterMapping',
  {
    restoreRunId: text('restoreRunId').notNull(),
    backupNovelId: integer('backupNovelId').notNull(),
    backupChapterId: integer('backupChapterId').notNull(),
    restoredNovelId: integer('restoredNovelId')
      .notNull()
      .references(() => novel.id, { onDelete: 'cascade' }),
    restoredChapterId: integer('restoredChapterId')
      .notNull()
      .references(() => chapter.id, { onDelete: 'cascade' }),
  },
  table => [
    uniqueIndex('restore_chapter_mapping_unique').on(
      table.restoreRunId,
      table.backupNovelId,
      table.backupChapterId,
    ),
    index('restore_chapter_mapping_novel_index').on(
      table.restoreRunId,
      table.backupNovelId,
    ),
  ],
);

export type RestoreChapterMappingRow =
  typeof restoreChapterMapping.$inferSelect;
export type RestoreChapterMappingInsert =
  typeof restoreChapterMapping.$inferInsert;
