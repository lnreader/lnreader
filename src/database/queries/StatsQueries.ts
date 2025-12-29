import { countBy } from 'lodash-es';
import { eq, count, and, sql } from 'drizzle-orm';
import { LibraryStats } from '../types';
import { dbManager } from '@database/db';
import {
  novel as novelSchema,
  chapter as chapterSchema,
} from '@database/schema';

/**
 * Get library statistics (novel count and distinct sources) using Drizzle ORM
 */
export const getLibraryStatsFromDb = async (): Promise<LibraryStats> => {
  const result = dbManager
    .select({
      novelsCount: count(),
      sourcesCount: sql<number>`COUNT(DISTINCT ${novelSchema.pluginId})`,
    })
    .from(novelSchema)
    .where(eq(novelSchema.inLibrary, true))
    .get();

  return (result as LibraryStats) ?? { novelsCount: 0, sourcesCount: 0 };
};

/**
 * Get total chapters count for all novels in library
 */
export const getChaptersTotalCountFromDb = async (): Promise<LibraryStats> => {
  const result = dbManager
    .select({ chaptersCount: count() })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(eq(novelSchema.inLibrary, true))
    .get();

  return (result as LibraryStats) ?? { chaptersCount: 0 };
};

/**
 * Get total read chapters count for all novels in library
 */
export const getChaptersReadCountFromDb = async (): Promise<LibraryStats> => {
  const result = dbManager
    .select({ chaptersRead: count() })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(
      and(eq(novelSchema.inLibrary, true), eq(chapterSchema.unread, false)),
    )
    .get();

  return (result as LibraryStats) ?? { chaptersRead: 0 };
};

/**
 * Get total unread chapters count for all novels in library
 */
export const getChaptersUnreadCountFromDb = async (): Promise<LibraryStats> => {
  const result = dbManager
    .select({ chaptersUnread: count() })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(and(eq(novelSchema.inLibrary, true), eq(chapterSchema.unread, true)))
    .get();

  return (result as LibraryStats) ?? { chaptersUnread: 0 };
};

/**
 * Get total downloaded chapters count for all novels in library
 */
export const getChaptersDownloadedCountFromDb =
  async (): Promise<LibraryStats> => {
    const result = dbManager
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

    return (result as LibraryStats) ?? { chaptersDownloaded: 0 };
  };

/**
 * Get genre distribution for all novels in library
 */
export const getNovelGenresFromDb = async (): Promise<LibraryStats> => {
  const res = dbManager
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
  const res = dbManager
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
