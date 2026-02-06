import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const repository = sqliteTable(
  'Repository',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url').notNull(),
  },
  table => [uniqueIndex('repository_url_unique').on(table.url)],
);

export type RepositoryRow = typeof repository.$inferSelect;
export type RepositoryInsert = typeof repository.$inferInsert;
