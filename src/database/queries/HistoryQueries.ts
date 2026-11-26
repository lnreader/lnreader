import { eq, sql, isNotNull, desc, getColumns } from 'drizzle-orm';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import { dbManager } from '@database/db';
import { chapterSchema, novelSchema } from '@database/schema';
import { withoutChapterUpdateTrigger } from '@database/queries/ChapterQueries';

/**
 * Get reading history from the database using Drizzle ORM.
 * Groups by novelId and takes the latest read chapter for each novel.
 */
export const getHistoryFromDb = async () => {
  return dbManager
    .select({
      ...getColumns(chapterSchema),
      inLibrary: novelSchema.inLibrary,
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
    .all();
};

/**
 * Update the readTime of a chapter to the current time.
 */
export const insertHistory = async (chapterId: number): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
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
    await tx
      .update(chapterSchema)
      .set({ readTime: null })
      .where(eq(chapterSchema.id, chapterId))
      .run();
  });
};

// lastReadAt is the only novel stat that readTime feeds, and it is NULL once
// a novel has no read chapters.
const clearReadTime = (novelId?: number) =>
  withoutChapterUpdateTrigger(async tx => {
    if (novelId === undefined) {
      await tx.execute(
        'UPDATE Chapter SET readTime = NULL WHERE readTime IS NOT NULL',
      );
      await tx.execute(
        'UPDATE Novel SET lastReadAt = NULL WHERE lastReadAt IS NOT NULL',
      );
    } else {
      await tx.execute(
        'UPDATE Chapter SET readTime = NULL WHERE novelId = ? AND readTime IS NOT NULL',
        [novelId],
      );
      await tx.execute('UPDATE Novel SET lastReadAt = NULL WHERE id = ?', [
        novelId,
      ]);
    }
  });

/**
 * Clear the reading history for every chapter belonging to a novel.
 */
export const deleteNovelHistory = async (novelId: number): Promise<void> => {
  await clearReadTime(novelId);
};

/**
 * Clear all reading history by setting readTime to NULL for all chapters.
 */
export const deleteAllHistory = async (): Promise<void> => {
  await clearReadTime();
  showToast(getString('historyScreen.deleted'));
};
