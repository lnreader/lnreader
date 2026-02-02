import {
  eq,
  getTableColumns,
  sql,
  inArray,
  and,
  lte,
  isNotNull,
  desc,
  asc,
  count,
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
import { SQLBatchTuple } from 'node_modules/@op-engineering/op-sqlite/lib/typescript/src';

// #region Mutations

/**
 * Insert or update chapters using Drizzle ORM
 */
export const insertChapters = async (
  novelId: number,
  chapters?: ChapterItem[],
): Promise<void> => {
  if (!chapters?.length) {
    return;
  }
  console.time('insertChapters');
  const sqlString = `insert into "Chapter" ("id", "novelId", "path", "name", "releaseTime", "bookmark", "unread", "readTime", "isDownloaded", "updatedTime", "chapterNumber", "page", "position", "progress")
    values (null, ?, ?, ?, ?, ?, ?, null, ?, null, ?, ?, ?, null)
    on conflict ("Chapter"."novelId", "Chapter"."path")
    do update set "name" = ?, "releaseTime" = ?, "chapterNumber" = ?, "page" = ?, "position" = ?`;
  const batchValues = [];
  for (let index = 0; index < chapters.length; index++) {
    batchValues.push([
      novelId, // novelId
      chapters[index].path, // path
      chapters[index].name || 'Chapter ' + (index + 1), // name
      chapters[index].releaseTime || '', // releaseTime
      0, // bookmark
      1, // unread
      0, // isDownloaded
      chapters[index].chapterNumber ?? null, // chapterNumber
      chapters[index].page || '1', // page
      index, // position  || update values
      chapters[index].name || 'Chapter ' + (index + 1),
      chapters[index].releaseTime || '',
      chapters[index].chapterNumber ?? null,
      chapters[index].page || '1',
      index,
    ]);
  }
  const commands: SQLBatchTuple[] = [[sqlString, batchValues]];
  await dbManager.batch(commands);

  console.timeEnd('insertChapters');
};

export const markChapterRead = async (chapterId: number): Promise<void> => {
  await dbManager.write(async tx => {
    tx.update(chapterSchema)
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
    tx.update(chapterSchema)
      .set({ unread: false })
      .where(inArray(chapterSchema.id, chapterIds))
      .run();
  });
};

export const markChapterUnread = async (chapterId: number): Promise<void> => {
  await dbManager.write(async tx => {
    tx.update(chapterSchema)
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
    tx.update(chapterSchema)
      .set({ unread: true })
      .where(inArray(chapterSchema.id, chapterIds))
      .run();
  });
};

export const markAllChaptersRead = async (novelId: number): Promise<void> => {
  await dbManager.write(async tx => {
    tx.update(chapterSchema)
      .set({ unread: false })
      .where(eq(chapterSchema.novelId, novelId))
      .run();
  });
};

export const markAllChaptersUnread = async (novelId: number): Promise<void> => {
  await dbManager.write(async tx => {
    tx.update(chapterSchema)
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
    tx.update(chapterSchema)
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
    tx.update(chapterSchema)
      .set({ isDownloaded: false })
      .where(inArray(chapterSchema.id, chapterIds))
      .run();
  });
};

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
    tx.update(chapterSchema).set({ isDownloaded: false }).run();
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
      tx.update(chapterSchema)
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
    tx.update(chapterSchema)
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
    tx.update(chapterSchema)
      .set({ progress })
      .where(inArray(chapterSchema.id, chapterIds))
      .run();
  });
};

export const bookmarkChapter = async (chapterId: number): Promise<void> => {
  await dbManager.write(async tx => {
    tx.update(chapterSchema)
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
    tx.update(chapterSchema)
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
    tx.update(chapterSchema)
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
    tx.update(chapterSchema).set({ updatedTime: null }).run();
  });
};

// #endregion
// #region Selectors

export const getCustomPages = async (novelId: number) => {
  return await dbManager
    .selectDistinct({ page: chapterSchema.page })
    .from(chapterSchema)
    .where(eq(chapterSchema.novelId, novelId))
    .all();
};

export const getNovelChapters = async (
  novelId: number,
): Promise<ChapterInfo[]> =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(eq(chapterSchema.novelId, novelId));

export const getUnreadNovelChapters = async (
  novelId: number,
): Promise<ChapterInfo[]> =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(eq(chapterSchema.novelId, novelId), eq(chapterSchema.unread, true)),
    );

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

export const getChapterCount = async (novelId: number, page: string = '1') =>
  await dbManager.$count(
    chapterSchema,
    and(eq(chapterSchema.novelId, novelId), eq(chapterSchema.page, page)),
  );

export const getPageChaptersBatched = async (
  novelId: number,
  sort?: ChapterOrderKey,
  filter?: ChapterFilterKey[],
  page?: string,
  batch: number = 0,
) => {
  const limit = 300;
  const offset = 300 * batch;
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

export const getNovelChaptersByNumber = (
  novelId: number,
  chapterNumber: number,
) => {
  return db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND position = ?',
    novelId,
    chapterNumber - 1,
  );
};

export const getNovelChaptersByName = (novelId: number, searchText: string) => {
  return db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND name LIKE ?',
    novelId,
    `%${searchText}%`,
  );
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
        sql`((position < ${chapterPosition} AND page = ${page}) OR page < ${page})`,
      ),
    )
    .orderBy(desc(chapterSchema.position), desc(chapterSchema.page))
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
        sql`((page = ${page} AND position > ${chapterPosition}) OR (position = 0 AND page > ${page}))`,
      ),
    )
    .orderBy(asc(chapterSchema.position), asc(chapterSchema.page))
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
      ...getTableColumns(chapterSchema),
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
      ...getTableColumns(chapterSchema),
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
