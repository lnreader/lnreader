import { eq, sql, isNotNull, desc, getTableColumns } from 'drizzle-orm';
import { History } from '@database/types';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { dbManager } from '@database/db';
import { chapterSchema, novelSchema } from '@database/schema';

/**
 * Get reading history from the database using Drizzle ORM.
 * Groups by novelId and takes the latest read chapter for each novel.
 */
export const getHistoryFromDb = async (): Promise<History[]> => {
  return dbManager
    .select({
      ...getTableColumns(chapterSchema),
      pluginId: novelSchema.pluginId,
      novelName: novelSchema.name,
      novelPath: novelSchema.path,
      novelCover: novelSchema.cover,
      novelId: novelSchema.id,
    })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(isNotNull(chapterSchema.readTime))
    .groupBy(chapterSchema.novelId)
    .having(sql`${chapterSchema.readTime} = MAX(${chapterSchema.readTime})`)
    .orderBy(desc(chapterSchema.readTime))
    .all() as History[];
};

/**
 * Update the readTime of a chapter to the current time.
 */
export const insertHistory = async (chapterId: number): Promise<void> => {
  await dbManager.write(async tx => {
    tx.update(chapterSchema)
      .set({
        readTime: sql`datetime('now','localtime')`,
      })
      .where(eq(chapterSchema.id, chapterId))
      .run();
  });
};

/**
 * Remove a chapter from history by setting its readTime to NULL.
 */
export const deleteChapterHistory = async (
  chapterId: number,
): Promise<void> => {
  await dbManager.write(async tx => {
    tx.update(chapterSchema)
      .set({ readTime: null })
      .where(eq(chapterSchema.id, chapterId))
      .run();
  });
};

/**
 * Clear all reading history by setting readTime to NULL for all chapters.
 */
export const deleteAllHistory = async (): Promise<void> => {
  await dbManager.write(async tx => {
    tx.update(chapterSchema).set({ readTime: null }).run();
  });
  showToast(getString('historyScreen.deleted'));
};
