import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

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

export type NovelRow = typeof novel.$inferSelect;
export type NovelInsert = typeof novel.$inferInsert;
