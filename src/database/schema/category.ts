import {
  index,
  integer,
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

export type CategoryRow = typeof category.$inferSelect;
export type CategoryInsert = typeof category.$inferInsert;
