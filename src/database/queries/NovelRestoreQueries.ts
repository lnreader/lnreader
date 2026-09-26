import { and, eq, inArray, or } from 'drizzle-orm';
import type { SQLBatchTuple, Scalar } from '@op-engineering/op-sqlite';

import { fetchNovel } from '@services/plugin/fetch';
import { insertChapters } from './ChapterQueries';
import { getCategoryForNewNovel } from './NovelQueries';

import { dbManager } from '@database/db';
import {
  createNovelTriggerQueryDelete,
  createNovelTriggerQueryInsert,
  createNovelTriggerQueryUpdate,
} from '@database/queryStrings/triggers';
import {
  novelCategorySchema,
  novelSchema,
  restoreChapterMappingSchema,
} from '@database/schema';
import { NOVEL_STORAGE } from '@utils/Storages';
import type { BackupNovel, NovelInfo, RestoredNovelMapping } from '../types';

/**
 * Restore a novel from backup using Drizzle ORM.
 */
export const restoreLibrary = async (novel: NovelInfo) => {
  const sourceNovel = await fetchNovel(novel.pluginId, novel.path).catch(e => {
    throw e;
  });

  const novelId = await dbManager.write(async tx => {
    const row = await tx
      .insert(novelSchema)
      .values({
        path: sourceNovel.path,
        name: novel.name,
        pluginId: novel.pluginId,
        cover: novel.cover || '',
        summary: novel.summary || '',
        author: novel.author || '',
        artist: novel.artist || '',
        status: novel.status || '',
        genres: novel.genres || '',
        totalPages: sourceNovel.totalPages || 0,
        inLibrary: true,
      })
      .onConflictDoUpdate({
        target: [novelSchema.path, novelSchema.pluginId],
        set: {
          name: novel.name,
          cover: novel.cover || '',
          summary: novel.summary || '',
          author: novel.author || '',
          artist: novel.artist || '',
          status: novel.status || '',
          genres: novel.genres || '',
          totalPages: sourceNovel.totalPages || 0,
          inLibrary: true,
        },
      })
      .returning()
      .get();

    if (row) {
      const defaultCategory = await getCategoryForNewNovel(tx);

      if (defaultCategory) {
        await tx
          .insert(novelCategorySchema)
          .values({
            novelId: row.id,
            categoryId: defaultCategory.id,
          })
          .onConflictDoNothing()
          .run();
      }
    }
    return row?.id;
  });

  if (novelId && sourceNovel.chapters) {
    await insertChapters(novelId, sourceNovel.chapters);
  }
};
const sqliteBoolean = (value: boolean | null | undefined): Scalar =>
  value == null ? null : value ? 1 : 0;
const RESTORE_NOVEL_BATCH_SIZE = 100;
const RESTORE_CHAPTER_BATCH_SIZE = 10_000;

export type RestoreNovelOptions = {
  includeChapterMappings?: boolean;
  restoreRunId?: string;
};

const NOVEL_UPSERT_SQL = `
  INSERT INTO Novel (
    path, pluginId, name, cover, summary, author, artist, status, genres,
    inLibrary, isLocal, totalPages
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(path, pluginId) DO UPDATE SET
    path = excluded.path,
    pluginId = excluded.pluginId,
    name = excluded.name,
    cover = excluded.cover,
    summary = excluded.summary,
    author = excluded.author,
    artist = excluded.artist,
    status = excluded.status,
    genres = excluded.genres,
    inLibrary = excluded.inLibrary,
    isLocal = excluded.isLocal,
    totalPages = excluded.totalPages
`;

const NOVEL_COVER_UPDATE_SQL = `
  UPDATE Novel
  SET cover = ? || pluginId || '/' || id || '/cover.png' || ?
  WHERE pluginId = ? AND path = ?
`;

const restoreNovelValues = (novel: BackupNovel): Scalar[] => [
  novel.path,
  novel.pluginId,
  novel.name,
  novel.cover ?? null,
  novel.summary ?? null,
  novel.author ?? null,
  novel.artist ?? null,
  novel.status ?? null,
  novel.genres ?? null,
  sqliteBoolean(novel.inLibrary),
  sqliteBoolean(novel.isLocal),
  novel.totalPages ?? null,
];

const restoreNovelChunk = async (
  backupNovels: BackupNovel[],
): Promise<RestoredNovelMapping[]> => {
  const commands: SQLBatchTuple[] = [
    [NOVEL_UPSERT_SQL, backupNovels.map(restoreNovelValues)],
  ];
  const storedCovers = backupNovels
    .filter(novel => novel.cover?.startsWith(`file://${NOVEL_STORAGE}/`))
    .map(
      novel =>
        [
          `file://${NOVEL_STORAGE}/`,
          novel.cover?.match(/[?#].*$/)?.[0] ?? '',
          novel.pluginId,
          novel.path,
        ] as Scalar[],
    );
  if (storedCovers.length > 0) {
    commands.push([NOVEL_COVER_UPDATE_SQL, storedCovers]);
  }
  await dbManager.executeBatch(commands);

  const rows = await dbManager
    .select({
      id: novelSchema.id,
      path: novelSchema.path,
      pluginId: novelSchema.pluginId,
    })
    .from(novelSchema)
    .where(
      or(
        ...backupNovels.map(novel =>
          and(
            eq(novelSchema.pluginId, novel.pluginId),
            eq(novelSchema.path, novel.path),
          ),
        ),
      ),
    )
    .all();
  const rowsByIdentity = new Map(
    rows.map(row => [`${row.pluginId}\u0000${row.path}`, row]),
  );
  return backupNovels.map(backupNovel => {
    const row = rowsByIdentity.get(
      `${backupNovel.pluginId}\u0000${backupNovel.path}`,
    );
    if (!row) {
      throw new Error('Restore returned incomplete novel mapping');
    }
    return {
      pluginId: backupNovel.pluginId,
      backupNovelId: backupNovel.id,
      restoredNovelId: row.id,
    };
  });
};

const restoreNovelChunkWithRetry = async (
  backupNovels: BackupNovel[],
): Promise<RestoredNovelMapping[]> => {
  try {
    return await restoreNovelChunk(backupNovels);
  } catch {
    const mappings: RestoredNovelMapping[] = [];
    let failed = false;
    for (const backupNovel of backupNovels) {
      try {
        mappings.push(
          await restoreNovelChunk([backupNovel]).then(([mapping]) => {
            if (!mapping) {
              throw new Error('Failed to restore novel');
            }
            return mapping;
          }),
        );
      } catch {
        failed = true;
      }
    }
    if (failed) {
      throw new Error('Failed to restore one or more novels');
    }
    return mappings;
  }
};

const restoreChapterValues = (
  chapter: BackupNovel['chapters'][number],
  restoredNovelId: number,
): Scalar[] => [
  restoredNovelId,
  chapter.path,
  chapter.name,
  chapter.releaseTime ?? null,
  sqliteBoolean(chapter.bookmark),
  sqliteBoolean(chapter.unread),
  chapter.readTime ?? null,
  sqliteBoolean(chapter.isDownloaded),
  chapter.updatedTime ?? null,
  chapter.chapterNumber ?? null,
  chapter.page ?? null,
  chapter.position ?? null,
  chapter.progress ?? null,
  chapter.scanlator ?? null,
  chapter.timeSpent ?? null,
];

type ChapterRestoreRecord = {
  backupNovelId: number;
  backupChapterId: number;
  restoredNovelId: number;
  chapter: BackupNovel['chapters'][number];
};

const CHAPTER_UPSERT_SQL = `
  INSERT INTO Chapter (
    novelId, path, name, releaseTime, bookmark, unread, readTime,
    isDownloaded, updatedTime, chapterNumber, page, position, progress,
    scanlator, timeSpent
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(novelId, path) DO UPDATE SET
    novelId = excluded.novelId,
    path = excluded.path,
    name = excluded.name,
    releaseTime = excluded.releaseTime,
    bookmark = excluded.bookmark,
    unread = excluded.unread,
    readTime = excluded.readTime,
    isDownloaded = excluded.isDownloaded,
    updatedTime = excluded.updatedTime,
    chapterNumber = excluded.chapterNumber,
    page = excluded.page,
    position = excluded.position,
    progress = excluded.progress,
    scanlator = excluded.scanlator,
    timeSpent = excluded.timeSpent
`;

const RESTORE_CHAPTER_MAPPING_INSERT_SQL = `
  INSERT INTO RestoreChapterMapping (
    restoreRunId, backupNovelId, backupChapterId,
    restoredNovelId, restoredChapterId
  )
  SELECT ?, ?, ?, ?, id
  FROM Chapter
  WHERE novelId = ? AND path = ?
  ON CONFLICT(restoreRunId, backupNovelId, backupChapterId) DO UPDATE SET
    restoredNovelId = excluded.restoredNovelId,
    restoredChapterId = excluded.restoredChapterId
`;

const restoreChapterChunk = async (
  records: ChapterRestoreRecord[],
  includeChapterMappings: boolean,
  restoreRunId: string | undefined,
) => {
  if (records.length === 0) {
    return;
  }
  if (includeChapterMappings && !restoreRunId) {
    throw new Error('Restore run ID is required for chapter mappings');
  }

  const commands: SQLBatchTuple[] = [
    ['DROP TRIGGER IF EXISTS update_novel_stats'],
    ['DROP TRIGGER IF EXISTS update_novel_stats_on_update'],
    ['DROP TRIGGER IF EXISTS update_novel_stats_on_delete'],
    [
      CHAPTER_UPSERT_SQL,
      records.map(record =>
        restoreChapterValues(record.chapter, record.restoredNovelId),
      ),
    ],
  ];
  if (includeChapterMappings) {
    commands.push([
      RESTORE_CHAPTER_MAPPING_INSERT_SQL,
      records.map(
        record =>
          [
            restoreRunId,
            record.backupNovelId,
            record.backupChapterId,
            record.restoredNovelId,
            record.restoredNovelId,
            record.chapter.path,
          ] as Scalar[],
      ),
    ]);
  }
  commands.push(
    [createNovelTriggerQueryInsert],
    [createNovelTriggerQueryDelete],
    [createNovelTriggerQueryUpdate],
  );
  await dbManager.executeBatch(commands);
};

const restoreChapterChunkWithRetry = async (
  records: ChapterRestoreRecord[],
  includeChapterMappings: boolean,
  restoreRunId: string | undefined,
) => {
  try {
    await restoreChapterChunk(records, includeChapterMappings, restoreRunId);
  } catch {
    let failed = false;
    for (const record of records) {
      try {
        await restoreChapterChunk(
          [record],
          includeChapterMappings,
          restoreRunId,
        );
      } catch {
        failed = true;
      }
    }
    if (failed) {
      throw new Error('Failed to restore one or more chapters');
    }
  }
};

const NOVEL_STATS_UPDATE_SQL = `
  UPDATE Novel
  SET totalChapters = (
        SELECT COUNT(*)
        FROM Chapter
        WHERE Chapter.novelId = Novel.id
      ),
      chaptersDownloaded = COALESCE((
        SELECT SUM(CASE WHEN Chapter.isDownloaded = 1 THEN 1 ELSE 0 END)
        FROM Chapter
        WHERE Chapter.novelId = Novel.id
      ), 0),
      chaptersUnread = COALESCE((
        SELECT SUM(CASE WHEN Chapter.unread = 1 THEN 1 ELSE 0 END)
        FROM Chapter
        WHERE Chapter.novelId = Novel.id
      ), 0),
      lastReadAt = (
        SELECT MAX(Chapter.readTime)
        FROM Chapter
        WHERE Chapter.novelId = Novel.id
      ),
      lastUpdatedAt = (
        SELECT updatedChapter.updatedTime
        FROM Chapter AS updatedChapter
        WHERE updatedChapter.novelId = Novel.id
          AND updatedChapter.updatedTime IS NOT NULL
        ORDER BY julianday(updatedChapter.updatedTime) DESC
        LIMIT 1
      )
  WHERE Novel.id = ?
`;

const refreshRestoredNovelStats = async (novelIds: number[]) => {
  if (novelIds.length === 0) {
    return;
  }
  await dbManager.executeBatch([
    [NOVEL_STATS_UPDATE_SQL, novelIds.map(id => [id] as Scalar[])],
  ]);
};

export const _restoreNovelsAndChapters = async (
  backupNovels: BackupNovel[],
  options: RestoreNovelOptions = {},
): Promise<RestoredNovelMapping[]> => {
  if (backupNovels.length === 0) {
    return [];
  }
  const includeChapterMappings = options.includeChapterMappings ?? true;
  if (includeChapterMappings && !options.restoreRunId) {
    throw new Error('Restore run ID is required for chapter mappings');
  }

  const mappings: RestoredNovelMapping[] = [];
  for (
    let start = 0;
    start < backupNovels.length;
    start += RESTORE_NOVEL_BATCH_SIZE
  ) {
    mappings.push(
      ...(await restoreNovelChunkWithRetry(
        backupNovels.slice(start, start + RESTORE_NOVEL_BATCH_SIZE),
      )),
    );
  }

  const restoredNovelIds = new Map(
    mappings.map(mapping => [mapping.backupNovelId, mapping.restoredNovelId]),
  );
  const chapterChunk: ChapterRestoreRecord[] = [];
  for (const backupNovel of backupNovels) {
    const restoredNovelId = restoredNovelIds.get(backupNovel.id);
    if (restoredNovelId === undefined) {
      throw new Error('Missing restored novel mapping');
    }
    for (const chapter of backupNovel.chapters) {
      chapterChunk.push({
        backupNovelId: backupNovel.id,
        backupChapterId: chapter.id,
        restoredNovelId,
        chapter,
      });
      if (chapterChunk.length === RESTORE_CHAPTER_BATCH_SIZE) {
        await restoreChapterChunkWithRetry(
          chapterChunk,
          includeChapterMappings,
          options.restoreRunId,
        );
        chapterChunk.length = 0;
      }
    }
  }
  if (chapterChunk.length > 0) {
    await restoreChapterChunkWithRetry(
      chapterChunk,
      includeChapterMappings,
      options.restoreRunId,
    );
  }
  await refreshRestoredNovelStats([...restoredNovelIds.values()]);
  return mappings;
};

/**
 * Restores a novel and its chapters from a backup object.
 */
export const _restoreNovelAndChapters = async (
  backupNovel: BackupNovel,
  options: RestoreNovelOptions = {},
): Promise<RestoredNovelMapping> => {
  const [mapping] = await _restoreNovelsAndChapters([backupNovel], options);
  if (!mapping) {
    throw new Error('Failed to restore novel');
  }
  return mapping;
};

export const getRestoreChapterMappings = async (
  restoreRunId: string,
  backupNovelId: number,
  backupChapterIds: number[],
) => {
  if (backupChapterIds.length === 0) {
    return [];
  }
  return dbManager
    .select({
      backupChapterId: restoreChapterMappingSchema.backupChapterId,
      restoredChapterId: restoreChapterMappingSchema.restoredChapterId,
    })
    .from(restoreChapterMappingSchema)
    .where(
      and(
        eq(restoreChapterMappingSchema.restoreRunId, restoreRunId),
        eq(restoreChapterMappingSchema.backupNovelId, backupNovelId),
        inArray(restoreChapterMappingSchema.backupChapterId, backupChapterIds),
      ),
    )
    .all();
};

export const clearRestoreChapterMappings = async (restoreRunId: string) => {
  await dbManager.write(tx =>
    tx
      .delete(restoreChapterMappingSchema)
      .where(eq(restoreChapterMappingSchema.restoreRunId, restoreRunId))
      .run(),
  );
};
