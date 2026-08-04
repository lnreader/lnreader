import { eq, count, sql } from 'drizzle-orm';
import { LibraryStats } from '../types';
import { dbManager } from '@database/db';
import {
  novelSchema,
  chapterSchema,
  categorySchema,
  novelCategorySchema,
} from '@database/schema';

/**
 * Get top novels based on time spent
 */
export const getTopNovelsByTimeSpentFromDb =
  async (): Promise<LibraryStats> => {
    const result = await dbManager
      .select({
        id: novelSchema.id,
        pluginId: novelSchema.pluginId,
        cover: novelSchema.cover,
        name: novelSchema.name,
        timeSpent: sql<number>`SUM(${chapterSchema.timeSpent})`,
      })
      .from(novelSchema)
      .innerJoin(chapterSchema, eq(chapterSchema.novelId, novelSchema.id))
      .where(eq(novelSchema.inLibrary, true))
      .groupBy(novelSchema.id)
      .orderBy(sql`SUM(${chapterSchema.timeSpent}) DESC`)
      .having(sql`SUM(${chapterSchema.timeSpent}) > 0`)
      .limit(10)
      .all();

    return { topNovelsByTimeSpent: result };
  };

/** Get top categories based on time spent */
export const getTopCategoriesByTimeSpentFromDb =
  async (): Promise<LibraryStats> => {
    const result = await dbManager
      .select({
        id: categorySchema.id,
        name: categorySchema.name,
        timeSpent: sql<number>`SUM(${chapterSchema.timeSpent})`,
      })
      .from(categorySchema)
      .innerJoin(
        novelCategorySchema,
        eq(categorySchema.id, novelCategorySchema.categoryId),
      )
      .innerJoin(novelSchema, eq(novelSchema.id, novelCategorySchema.novelId))
      .innerJoin(chapterSchema, eq(novelSchema.id, chapterSchema.novelId))
      .groupBy(categorySchema.id)
      .orderBy(sql`SUM(${chapterSchema.timeSpent}) DESC`)
      .having(sql`SUM(${chapterSchema.timeSpent}) > 0`)
      .limit(10)
      .all();
    return { topCategoriesByTimeSpent: result };
  };

export interface NovelWithGenres {
  id: number;
  name: string;
  path: string;
  cover: string | null;
  pluginId: string;
  genres: string | null;
  status: string | null;
}

export const getNovelsWithGenresFromDb = async (): Promise<
  NovelWithGenres[]
> => {
  const res = await dbManager
    .select({
      id: novelSchema.id,
      path: novelSchema.path,
      name: novelSchema.name,
      cover: novelSchema.cover,
      pluginId: novelSchema.pluginId,
      genres: novelSchema.genres,
      status: novelSchema.status,
    })
    .from(novelSchema)
    .where(eq(novelSchema.inLibrary, true))
    .all();
  return res;
};

/**
 * Get aggregate library stats from Novel table pre-computed columns.
 * Single query replaces: getLibraryStatsFromDb, getChaptersTotalCountFromDb,
 * getChaptersReadCountFromDb, getChaptersUnreadCountFromDb,
 * getChaptersDownloadedCountFromDb, getTotalTimeSpentFromDb.
 */
export const getAggregateStatsFromDb = async (): Promise<LibraryStats> => {
  const result = await dbManager
    .select({
      novelsCount: count(),
      sourcesCount: sql<number>`COUNT(DISTINCT ${novelSchema.pluginId})`,
      chaptersCount: sql<number>`COALESCE(SUM(${novelSchema.totalChapters}), 0)`,
      chaptersDownloaded: sql<number>`COALESCE(SUM(${novelSchema.chaptersDownloaded}), 0)`,
      chaptersUnread: sql<number>`COALESCE(SUM(${novelSchema.chaptersUnread}), 0)`,
      totalTimeSpent: sql<number>`COALESCE((SELECT SUM(${chapterSchema.timeSpent}) FROM ${chapterSchema} ch INNER JOIN ${novelSchema} n ON ch.novelId = n.id WHERE n.inLibrary = true), 0)`,
    })
    .from(novelSchema)
    .where(eq(novelSchema.inLibrary, true))
    .get();

  return {
    novelsCount: result?.novelsCount ?? 0,
    sourcesCount: result?.sourcesCount ?? 0,
    chaptersCount: result?.chaptersCount ?? 0,
    chaptersRead: (result?.chaptersCount ?? 0) - (result?.chaptersUnread ?? 0),
    chaptersUnread: result?.chaptersUnread ?? 0,
    chaptersDownloaded: result?.chaptersDownloaded ?? 0,
    totalTimeSpent: result?.totalTimeSpent ?? 0,
  };
};
