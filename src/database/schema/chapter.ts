import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const chapter = sqliteTable(
  'Chapter',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    novelId: integer('novelId').notNull(),
    path: text('path').notNull(),
    name: text('name').notNull(),
    releaseTime: text('releaseTime'),
    bookmark: integer('bookmark', { mode: 'boolean' }).default(false),
    unread: integer('unread', { mode: 'boolean' }).default(true),
    readTime: text('readTime'),
    isDownloaded: integer('isDownloaded', { mode: 'boolean' }).default(false),
    updatedTime: text('updatedTime'),
    chapterNumber: real('chapterNumber'),
    page: text('page').default('1'),
    // Reading-order index across the whole novel. Derived from
    // (page, pagePosition) plus the plugin's pageOrder, so it stays correct
    // for sources that paginate newest-first.
    position: integer('position').default(0),
    // Index of the chapter within the source page that served it.
    pagePosition: integer('pagePosition').default(0),
    progress: integer('progress'),
    scanlator: text('scanlator'),
    timeSpent: integer('timeSpent').default(0),
  },
  table => [
    uniqueIndex('chapter_novel_path_unique').on(table.novelId, table.path),
    index('chapterNovelIdIndex').on(
      table.novelId,
      table.position,
      table.page,
      table.id,
    ),
  ],
);

export type ChapterRow = typeof chapter.$inferSelect;
export type ChapterInsert = typeof chapter.$inferInsert;
