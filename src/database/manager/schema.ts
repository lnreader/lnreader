import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const category = sqliteTable(
  'Category',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    sort: integer('sort'),
  },
  table => [
    uniqueIndex('category_name_unique').on(table.name),
    index('category_sort_idx').on(table.sort),
  ],
);

export const novel = sqliteTable(
  'Novel',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    path: text('path').notNull(),
    pluginId: text('pluginId').notNull(),
    name: text('name').notNull(),
    cover: text('cover'),
    summary: text('summary'),
    author: text('author'),
    artist: text('artist'),
    status: text('status').default('Unknown'),
    genres: text('genres'),
    inLibrary: integer('inLibrary', { mode: 'boolean' }).default(false),
    isLocal: integer('isLocal', { mode: 'boolean' }).default(false),
    totalPages: integer('totalPages').default(0),
    chaptersDownloaded: integer('chaptersDownloaded').default(0),
    chaptersUnread: integer('chaptersUnread').default(0),
    totalChapters: integer('totalChapters').default(0),
    lastReadAt: text('lastReadAt'),
    lastUpdatedAt: text('lastUpdatedAt'),
  },
  table => [
    uniqueIndex('novel_path_plugin_unique').on(table.path, table.pluginId),
    index('NovelIndex').on(
      table.pluginId,
      table.path,
      table.id,
      table.inLibrary,
    ),
  ],
);

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
    position: integer('position').default(0),
    progress: integer('progress'),
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

export const novelCategory = sqliteTable(
  'NovelCategory',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    novelId: integer('novelId').notNull(),
    categoryId: integer('categoryId').notNull(),
  },
  table => [
    uniqueIndex('novel_category_unique').on(table.novelId, table.categoryId),
  ],
);

export const repository = sqliteTable(
  'Repository',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url').notNull(),
  },
  table => [uniqueIndex('repository_url_unique').on(table.url)],
);

export const schema = {
  category,
  novel,
  chapter,
  novelCategory,
  repository,
};

export type Schema = typeof schema;
export type CategoryRow = typeof category.$inferSelect;
export type CategoryInsert = typeof category.$inferInsert;
export type NovelRow = typeof novel.$inferSelect;
export type NovelInsert = typeof novel.$inferInsert;
export type ChapterRow = typeof chapter.$inferSelect;
export type ChapterInsert = typeof chapter.$inferInsert;
export type NovelCategoryRow = typeof novelCategory.$inferSelect;
export type NovelCategoryInsert = typeof novelCategory.$inferInsert;
export type RepositoryRow = typeof repository.$inferSelect;
export type RepositoryInsert = typeof repository.$inferInsert;
