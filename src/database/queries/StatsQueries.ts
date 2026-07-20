import { countBy } from 'lodash-es';
import { eq, count, and, sql } from 'drizzle-orm';
import { LibraryStats } from '../types';
import { dbManager } from '@database/db';
import { novelSchema, chapterSchema, categorySchema, novelCategorySchema } from '@database/schema';

/**
 * Get library statistics (novel count and distinct sources) using Drizzle ORM
 */
export const getLibraryStatsFromDb = async (): Promise<LibraryStats> => {
  const result = await dbManager
    .select({
      novelsCount: count(),
      sourcesCount: sql<number>`COUNT(DISTINCT ${novelSchema.pluginId})`,
    })
    .from(novelSchema)
    .where(eq(novelSchema.inLibrary, true))
    .get();

  return result ?? { novelsCount: 0, sourcesCount: 0 };
};

/**
 * Get total chapters count for all novels in library
 */
export const getChaptersTotalCountFromDb = async (): Promise<LibraryStats> => {
  const result = await dbManager
    .select({ chaptersCount: count() })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(eq(novelSchema.inLibrary, true))
    .get();

  return result ?? { chaptersCount: 0 };
};

/**
 * Get top novels based on time spent
 */
export const getTopNovelsByTimeSpentFromDb = async (): Promise<LibraryStats> => {
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
export const getTopCategoriesByTimeSpentFromDb = async (): Promise<LibraryStats> => {
  const result = await dbManager
    .select({
      id: categorySchema.id,
      name: categorySchema.name,
      timeSpent: sql<number>`SUM(${chapterSchema.timeSpent})`
    })
    .from(categorySchema)
    .innerJoin(novelCategorySchema, eq(categorySchema.id, novelCategorySchema.categoryId))
    .innerJoin(novelSchema, eq(novelSchema.id, novelCategorySchema.novelId))
    .innerJoin(chapterSchema, eq(novelSchema.id, chapterSchema.novelId))
    .groupBy(categorySchema.id)
    .orderBy(sql`SUM(${chapterSchema.timeSpent}) DESC`)
    .having(sql`SUM(${chapterSchema.timeSpent}) > 0`)
    .limit(10)
    .all()
  return { topCategoriesByTimeSpent: result };
}

/** Sum up the timeSpent for all chapters */
export const getTotalTimeSpentFromDb = async (): Promise<LibraryStats> => {
  const result = await dbManager
    .select({ totalTimeSpent: sql<number>`COALESCE(SUM(${chapterSchema.timeSpent}), 0)` })
    .from(chapterSchema)
    .get();
  return { totalTimeSpent: result?.totalTimeSpent ?? 0 };
}

/**
 * Get total read chapters count for all novels in library
 */
export const getChaptersReadCountFromDb = async (): Promise<LibraryStats> => {
  const result = await dbManager
    .select({ chaptersRead: count() })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(
      and(eq(novelSchema.inLibrary, true), eq(chapterSchema.unread, false)),
    )
    .get();

  return result ?? { chaptersRead: 0 };
};

/**
 * Get total unread chapters count for all novels in library
 */
export const getChaptersUnreadCountFromDb = async (): Promise<LibraryStats> => {
  const result = await dbManager
    .select({ chaptersUnread: count() })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(and(eq(novelSchema.inLibrary, true), eq(chapterSchema.unread, true)))
    .get();

  return result ?? { chaptersUnread: 0 };
};

/**
 * Get total downloaded chapters count for all novels in library
 */
export const getChaptersDownloadedCountFromDb =
  async (): Promise<LibraryStats> => {
    const result = await dbManager
      .select({ chaptersDownloaded: count() })
      .from(chapterSchema)
      .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
      .where(
        and(
          eq(novelSchema.inLibrary, true),
          eq(chapterSchema.isDownloaded, true),
        ),
      )
      .get();

    return result ?? { chaptersDownloaded: 0 };
  };

/**
 * Get genre distribution for all novels in library
 */
export const getNovelGenresFromDb = async (): Promise<LibraryStats> => {
  const res = await dbManager
    .select({ genres: novelSchema.genres })
    .from(novelSchema)
    .where(eq(novelSchema.inLibrary, true))
    .all();

  const genres: string[] = [];
  res.forEach(item => {
    const novelGenres = item.genres?.split(/\s*,\s*/);

    if (novelGenres?.length) {
      genres.push(...novelGenres);
    }
  });

  return { genres: countBy(genres) };
};

/**
 * Get status distribution for all novels in library
 */
export const getNovelStatusFromDb = async (): Promise<LibraryStats> => {
  const res = await dbManager
    .select({ status: novelSchema.status })
    .from(novelSchema)
    .where(eq(novelSchema.inLibrary, true))
    .all();

  const statusList: string[] = [];
  res.forEach(item => {
    const novelStatus = item.status?.split(/\s*,\s*/);

    if (novelStatus?.length) {
      statusList.push(...novelStatus);
    }
  });

  return { status: countBy(statusList) };
};
