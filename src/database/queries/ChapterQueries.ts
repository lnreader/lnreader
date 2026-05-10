import {
  eq,
  getColumns,
  sql,
  inArray,
  and,
  lte,
  isNotNull,
  desc,
  asc,
  count,
  like,
  or,
  gt,
  lt,
} from 'drizzle-orm';
import { showToast } from '@utils/showToast';
import { ChapterInfo, DownloadedChapter, Update } from '../types';
import { ChapterItem } from '@plugins/types';

import { getString } from '@strings/translations';
import { NOVEL_STORAGE } from '@utils/Storages';
import { dbManager } from '@database/db';
import { chapterSchema, novelSchema } from '@database/schema';
import NativeFile from '@specs/NativeFile';
import { ChapterFilterKey, ChapterOrderKey } from '@database/constants';
import { chapterFilterToSQL, chapterOrderToSQL } from '@database/utils/parser';
import { castInt } from '@database/manager/manager';

// #region Mutations

/**
 * Insert or update chapters using Drizzle ORM
 */
export const insertChapters = async (
  novelId: number,
  chapters?: ChapterItem[],
  options?: {
    page?: string;
    touchUpdatedTime?: boolean;
    preferNullReleaseTime?: boolean;
  },
): Promise<void> => {
  if (!chapters?.length) {
    return;
  }

  const nowSql = sql`datetime('now','localtime')`;

  const rows = chapters.map((c, index) => ({
    path: c.path,
    name: c.name || `Chapter ${index + 1}`,
    releaseTime: c.releaseTime ?? (options?.preferNullReleaseTime ? null : ''),
    novelId,
    chapterNumber: c.chapterNumber ?? index + 1,
    page: options?.page ?? c.page ?? '1',
    position: index,
  }));
  await dbManager.batch(rows, (tx, ph) =>
    tx
      .insert(chapterSchema)
      .values({
        path: ph('path'),
        name: ph('name'),
        releaseTime: ph('releaseTime'),
        novelId: ph('novelId'),
        chapterNumber: ph('chapterNumber'),
        page: ph('page'),
        position: ph('position'),
        ...(options?.touchUpdatedTime ? { updatedTime: nowSql } : {}),
      })
      .onConflictDoUpdate({
        target: [chapterSchema.novelId, chapterSchema.path],
        set: {
          page: sql`excluded.page`,
          position: sql`excluded.position`,
          name: sql`excluded.name`,
          releaseTime: sql`excluded.releaseTime`,
          chapterNumber: sql`excluded.chapterNumber`,
          ...(options?.touchUpdatedTime ? { updatedTime: nowSql } : {}),
        },
        where: sql`NOT (
          ${chapterSchema.page} IS excluded.page
          AND ${chapterSchema.position} IS excluded.position
          AND ${chapterSchema.name} IS excluded.name
          AND ${chapterSchema.releaseTime} IS excluded.releaseTime
          AND ${chapterSchema.chapterNumber} IS excluded.chapterNumber
        )`,
      })
      .prepare(),
  );
};

export const markChapterRead = async (chapterId: number): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ unread: false })
      .where(eq(chapterSchema.id, chapterId))
      .run();
  });
};

export const markChaptersRead = async (chapterIds: number[]): Promise<void> => {
  if (!chapterIds.length) {
    return;
  }
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ unread: false })
      .where(inArray(chapterSchema.id, chapterIds))
      .run();
  });
};

export const markChapterUnread = async (chapterId: number): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ unread: true })
      .where(eq(chapterSchema.id, chapterId))
      .run();
  });
};

export const markChaptersUnread = async (
  chapterIds: number[],
): Promise<void> => {
  if (!chapterIds.length) {
    return;
  }
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ unread: true })
      .where(inArray(chapterSchema.id, chapterIds))
      .run();
  });
};

export const markAllChaptersRead = async (novelId: number): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ unread: false })
      .where(eq(chapterSchema.novelId, novelId))
      .run();
  });
};

export const markAllChaptersUnread = async (novelId: number): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ unread: true })
      .where(eq(chapterSchema.novelId, novelId))
      .run();
  });
};

const deleteDownloadedFiles = (
  pluginId: string,
  novelId: number,
  chapterId: number,
) => {
  try {
    const chapterFolder = `${NOVEL_STORAGE}/${pluginId}/${novelId}/${chapterId}`;
    NativeFile.unlink(chapterFolder);
  } catch {
    throw new Error(getString('novelScreen.deleteChapterError'));
  }
};

// delete downloaded chapter
export const deleteChapter = async (
  pluginId: string,
  novelId: number,
  chapterId: number,
): Promise<void> => {
  deleteDownloadedFiles(pluginId, novelId, chapterId);
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ isDownloaded: false })
      .where(eq(chapterSchema.id, chapterId))
      .run();
  });
};

export const deleteChapters = async (
  pluginId: string,
  novelId: number,
  chapters?: ChapterInfo[],
): Promise<void> => {
  if (!chapters?.length) {
    return;
  }
  const chapterIds = chapters.map(chapter => chapter.id);

  chapters.forEach(chapter =>
    deleteDownloadedFiles(pluginId, novelId, chapter.id),
  );

  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ isDownloaded: false })
      .where(inArray(chapterSchema.id, chapterIds))
      .run();
  });
};

// TODO: Remove the need for the chapters array, as it could lead to not deleting the downloaded files but just marking them as not downloaded
/*
  Deletes all downloaded chapters from the database
*/
export const deleteDownloads = async (
  chapters: DownloadedChapter[],
): Promise<void> => {
  if (!chapters?.length) {
    return;
  }
  chapters.forEach(chapter => {
    deleteDownloadedFiles(chapter.pluginId, chapter.novelId, chapter.id);
  });
  await dbManager.write(async tx => {
    await tx.update(chapterSchema).set({ isDownloaded: false }).run();
  });
};

export const deleteReadChaptersFromDb = async (): Promise<void> => {
  const chapters = await getReadDownloadedChapters();
  chapters?.forEach(chapter => {
    deleteDownloadedFiles(chapter.pluginId, chapter.novelId, chapter.id);
  });
  const chapterIds = chapters?.map(chapter => chapter.id);
  if (chapterIds?.length) {
    await dbManager.write(async tx => {
      await tx
        .update(chapterSchema)
        .set({ isDownloaded: false })
        .where(inArray(chapterSchema.id, chapterIds))
        .run();
    });
  }
  showToast(getString('novelScreen.readChaptersDeleted'));
};

export const updateChapterProgress = async (
  chapterId: number,
  progress: number,
): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ progress })
      .where(eq(chapterSchema.id, chapterId))
      .run();
  });
};

export const updateChapterProgressByIds = async (
  chapterIds: number[],
  progress: number,
): Promise<void> => {
  if (!chapterIds.length) {
    return;
  }
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ progress })
      .where(inArray(chapterSchema.id, chapterIds))
      .run();
  });
};

export const bookmarkChapter = async (chapterId: number): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ bookmark: sql`NOT ${chapterSchema.bookmark}` })
      .where(eq(chapterSchema.id, chapterId))
      .run();
  });
};

export const markPreviuschaptersRead = async (
  chapterId: number,
  novelId: number,
): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ unread: false })
      .where(
        and(
          lte(chapterSchema.id, chapterId),
          eq(chapterSchema.novelId, novelId),
        ),
      )
      .run();
  });
};

export const markPreviousChaptersUnread = async (
  chapterId: number,
  novelId: number,
): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .update(chapterSchema)
      .set({ unread: true })
      .where(
        and(
          lte(chapterSchema.id, chapterId),
          eq(chapterSchema.novelId, novelId),
        ),
      )
      .run();
  });
};

export const clearUpdates = async (): Promise<void> => {
  await dbManager.write(async tx => {
    await tx.update(chapterSchema).set({ updatedTime: null }).run();
  });
};

// #endregion
// #region Selectors

export const getCustomPages = (novelId: number) => {
  return dbManager.allSync(
    dbManager
      .selectDistinct({ page: chapterSchema.page })
      .from(chapterSchema)
      .where(eq(chapterSchema.novelId, novelId))
      .orderBy(asc(castInt(chapterSchema.page))),
  );
};

export const getNovelChapters = async (
  novelId: number,
  sort?: ChapterOrderKey,
  filter?: ChapterFilterKey[],
  page?: string,
  limit: number = 1000,
): Promise<ChapterInfo[]> =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        !page ? sql.raw('true') : eq(chapterSchema.page, page),
        chapterFilterToSQL(filter),
      ),
    )
    .orderBy(chapterOrderToSQL(sort))
    .limit(limit)
    .all();

export const getNovelChaptersSync = (
  novelId: number,
  sort?: ChapterOrderKey,
  filter?: ChapterFilterKey[],
  page?: string,
  limit: number = 1000,
): ChapterInfo[] =>
  dbManager.allSync(
    dbManager
      .select()
      .from(chapterSchema)
      .where(
        and(
          eq(chapterSchema.novelId, novelId),
          !page ? sql.raw('true') : eq(chapterSchema.page, page),
          chapterFilterToSQL(filter),
        ),
      )
      .orderBy(chapterOrderToSQL(sort))
      .limit(limit), // Adding a limit to prevent potential performance issues with large datasets
  );
/**
 * @deprecated, use getNovelChapters with whereConditions instead
 */
export const getUnreadNovelChapters = async (
  novelId: number,
): Promise<ChapterInfo[]> =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(eq(chapterSchema.novelId, novelId), eq(chapterSchema.unread, true)),
    );
/**
 * @deprecated, use getNovelChapters with whereConditions instead
 */
export const getAllUndownloadedChapters = async (
  novelId: number,
): Promise<ChapterInfo[]> =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        eq(chapterSchema.isDownloaded, false),
      ),
    );
/**
 * @deprecated, use getNovelChapters with whereConditions instead
 */
export const getAllUndownloadedAndUnreadChapters = async (
  novelId: number,
): Promise<ChapterInfo[]> =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        eq(chapterSchema.isDownloaded, false),
        eq(chapterSchema.unread, true),
      ),
    )
    .all();

export const getChapter = async (chapterId: number) =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(eq(chapterSchema.id, chapterId))
    .get();

export const getPageChapters = async (
  novelId: number,
  sort?: ChapterOrderKey,
  filter?: ChapterFilterKey[],
  page?: string,
  offset?: number,
  limit?: number,
): Promise<ChapterInfo[]> => {
  const query = dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        eq(chapterSchema.page, page || '1'),
        chapterFilterToSQL(filter),
      ),
    )
    .$dynamic();

  if (sort) {
    query.orderBy(chapterOrderToSQL(sort));
  }
  if (limit !== undefined) {
    query.limit(limit);
  }
  if (offset !== undefined) {
    query.offset(offset);
  }

  return query.all();
};

export const getChapterCount = async (
  novelId: number,
  page: string = '1',
  filter?: ChapterFilterKey[],
) =>
  await dbManager.$count(
    chapterSchema,
    and(
      eq(chapterSchema.novelId, novelId),
      eq(chapterSchema.page, page),
      chapterFilterToSQL(filter),
    ),
  );

export const getChapterCountSync = (
  novelId: number,
  page: string = '1',
  filter?: ChapterFilterKey[],
): number => {
  // Using count(*) as name because the current drizzle version generates wrong type
  const result = dbManager.getSync(
    dbManager
      .select({ 'count(*)': count() })
      .from(chapterSchema)
      .where(
        and(
          eq(chapterSchema.novelId, novelId),
          eq(chapterSchema.page, page),
          chapterFilterToSQL(filter),
        ),
      ),
  );

  return result?.['count(*)'] ?? 0;
};

export const getPageChaptersBatched = async (
  novelId: number,
  sort?: ChapterOrderKey,
  filter?: ChapterFilterKey[],
  page?: string,
  batch: number = 0,
) => {
  const limit = 1000;
  const offset = 1000 * batch;
  const query = dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        eq(chapterSchema.page, page || '1'),
        chapterFilterToSQL(filter),
      ),
    )
    .limit(limit)
    .offset(offset)
    .$dynamic();

  if (sort) {
    query.orderBy(chapterOrderToSQL(sort));
  }
  return query.all();
};

export const getNovelChaptersByNumber = async (
  novelId: number,
  chapterNumber: number,
) => {
  return dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        eq(chapterSchema.position, chapterNumber - 1),
      ),
    )
    .all();
};

export const getFirstUnreadChapter = (
  novelId: number,
  filter?: ChapterFilterKey[],
  page?: string,
) =>
  dbManager.getSync(
    dbManager
      .select()
      .from(chapterSchema)
      .where(
        and(
          eq(chapterSchema.novelId, novelId),
          eq(chapterSchema.page, page || '1'),
          eq(chapterSchema.unread, true),
          chapterFilterToSQL(filter),
        ),
      )
      .orderBy(asc(chapterSchema.position))
      .limit(1),
  );

export const getNovelChaptersByName = async (
  novelId: number,
  searchText: string,
) => {
  return dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        like(chapterSchema.name, `%${searchText}%`),
      ),
    )
    .all();
};

export const getPrevChapter = async (
  novelId: number,
  chapterPosition: number,
  page: string,
) =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        or(
          and(
            eq(chapterSchema.page, castInt(page)),
            lt(chapterSchema.position, castInt(chapterPosition)),
          ),
          lt(chapterSchema.page, castInt(page)),
        ),
      ),
    )
    .orderBy(
      desc(castInt(chapterSchema.page)),
      desc(castInt(chapterSchema.position)),
    )
    .get();

export const getNextChapter = async (
  novelId: number,
  chapterPosition: number,
  page: string,
) =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        or(
          and(
            eq(chapterSchema.page, castInt(page)),
            gt(chapterSchema.position, castInt(chapterPosition)),
          ),
          and(
            gt(chapterSchema.page, castInt(page)),
            eq(chapterSchema.position, 0),
          ),
        ),
      ),
    )
    .orderBy(
      asc(castInt(chapterSchema.page)),
      asc(castInt(chapterSchema.position)),
    )
    .get();

const getReadDownloadedChapters = async () =>
  dbManager
    .select({
      id: chapterSchema.id,
      novelId: chapterSchema.novelId,
      pluginId: novelSchema.pluginId,
    })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(novelSchema.id, chapterSchema.novelId))
    .where(
      and(
        eq(chapterSchema.unread, false),
        eq(chapterSchema.isDownloaded, true),
      ),
    )
    .all();

export const getDownloadedChapters = async () =>
  dbManager
    .select({
      ...getColumns(chapterSchema),
      pluginId: novelSchema.pluginId,
      novelName: novelSchema.name,
      novelCover: novelSchema.cover,
      novelPath: novelSchema.path,
    })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(eq(chapterSchema.isDownloaded, true))
    .all();

export const getNovelDownloadedChapters = async (
  novelId: number,
  startPosition?: number,
  endPosition?: number,
): Promise<ChapterInfo[]> => {
  const whereConditions = [
    eq(chapterSchema.novelId, novelId),
    eq(chapterSchema.isDownloaded, true),
  ];

  if (startPosition !== undefined && endPosition !== undefined) {
    whereConditions.push(
      sql`${chapterSchema.position} >= ${startPosition - 1}`,
    );
    whereConditions.push(sql`${chapterSchema.position} <= ${endPosition - 1}`);
  }

  return dbManager
    .select()
    .from(chapterSchema)
    .where(and(...whereConditions))
    .orderBy(asc(chapterSchema.position))
    .all();
};

export const getUpdatedOverviewFromDb = async () =>
  dbManager
    .select({
      novelId: novelSchema.id,
      novelName: novelSchema.name,
      novelCover: novelSchema.cover,
      novelPath: novelSchema.path,
      updateDate: sql<string>`DATE(${chapterSchema.updatedTime})`.as(
        'update_date',
      ),
      updatesPerDay: count(),
    })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(isNotNull(chapterSchema.updatedTime))
    .groupBy(novelSchema.id, sql`update_date`)
    .orderBy(desc(sql`update_date`), novelSchema.id)
    .all();

export const getDetailedUpdatesFromDb = async (
  novelId: number,
  onlyDownloadableChapters?: boolean,
): Promise<Update[]> => {
  return dbManager
    .select({
      ...getColumns(chapterSchema),
      pluginId: novelSchema.pluginId,
      novelId: novelSchema.id,
      novelName: novelSchema.name,
      novelPath: novelSchema.path,
      novelCover: novelSchema.cover,
    })
    .from(chapterSchema)
    .innerJoin(novelSchema, eq(chapterSchema.novelId, novelSchema.id))
    .where(
      and(
        eq(novelSchema.id, novelId),
        onlyDownloadableChapters
          ? eq(chapterSchema.isDownloaded, true)
          : isNotNull(chapterSchema.updatedTime),
      ),
    )
    .orderBy(desc(chapterSchema.updatedTime))
    .all();
};

export const isChapterDownloaded = (chapterId: number): boolean => {
  const result = dbManager.getSync(
    dbManager
      .select({ id: chapterSchema.id })
      .from(chapterSchema)
      .where(
        and(
          eq(chapterSchema.id, chapterId),
          eq(chapterSchema.isDownloaded, true),
        ),
      ),
  );

  return !!result;
};
