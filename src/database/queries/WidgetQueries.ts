import { and, count, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { dbManager } from '@database/db';
import { chapterSchema, novelSchema } from '@database/schema';

/**
 * Most recently read chapter of each novel, newest first, for the Continue
 * Reading widget.
 */
export const getWidgetReadingFromDb = (limit: number) =>
  dbManager
    .select({
      novelId: novelSchema.id,
      novelName: novelSchema.name,
      novelCover: novelSchema.cover,
      totalChapters: novelSchema.totalChapters,
      chapterId: chapterSchema.id,
      chapterName: chapterSchema.name,
      chapterNumber: chapterSchema.chapterNumber,
      progress: chapterSchema.progress,
      readTime: chapterSchema.readTime,
    })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(isNotNull(chapterSchema.readTime))
    .groupBy(chapterSchema.novelId)
    .having(sql`${chapterSchema.readTime} = MAX(${chapterSchema.readTime})`)
    .orderBy(desc(chapterSchema.readTime))
    .limit(limit)
    .all();

const unreadUpdatesFilter = and(
  isNotNull(chapterSchema.updatedTime),
  eq(chapterSchema.unread, true),
  eq(novelSchema.inLibrary, true),
);

/** Unread chapters found by library updates, newest first. */
export const getWidgetUpdatesFromDb = (limit: number) =>
  dbManager
    .select({
      novelId: novelSchema.id,
      novelName: novelSchema.name,
      novelCover: novelSchema.cover,
      chapterId: chapterSchema.id,
      chapterName: chapterSchema.name,
      chapterNumber: chapterSchema.chapterNumber,
      updatedTime: chapterSchema.updatedTime,
    })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(unreadUpdatesFilter)
    .orderBy(desc(chapterSchema.updatedTime), desc(chapterSchema.id))
    .limit(limit)
    .all();

export const getWidgetUpdatesCountFromDb = async (): Promise<number> => {
  const result = await dbManager
    .select({ value: count() })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(unreadUpdatesFilter)
    .get();
  return result?.value ?? 0;
};

/**
 * Chapters read per local day (`YYYY-MM-DD`) over the last [days] days.
 * readTime is written with `datetime('now','localtime')`, so DATE() is
 * already the reader's local day.
 */
export const getWidgetReadDaysFromDb = (days: number) => {
  const day = sql<string>`DATE(${chapterSchema.readTime})`;
  return dbManager
    .select({ day, chapters: count() })
    .from(chapterSchema)
    .where(
      and(
        isNotNull(chapterSchema.readTime),
        gte(
          chapterSchema.readTime,
          sql`DATE('now', 'localtime', ${`-${days} days`})`,
        ),
      ),
    )
    .groupBy(day)
    .all();
};

/** Backs the Quick Actions "Random" button. */
export const getRandomLibraryNovelFromDb = () =>
  dbManager
    .select()
    .from(novelSchema)
    .where(eq(novelSchema.inLibrary, true))
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .get();
