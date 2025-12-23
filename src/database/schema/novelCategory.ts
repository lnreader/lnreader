import {
  integer,
  sqliteTable,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

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

export type NovelCategoryRow = typeof novelCategory.$inferSelect;
export type NovelCategoryInsert = typeof novelCategory.$inferInsert;
