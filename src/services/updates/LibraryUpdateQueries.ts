import { fetchNovel, fetchPage } from '../plugin/fetch';
import { ChapterItem, SourceNovel } from '@plugins/types';
import { getPlugin, LOCAL_PLUGIN_ID } from '@plugins/pluginManager';
import { NOVEL_STORAGE } from '@utils/Storages';
import { downloadFile } from '@plugins/helpers/fetch';
import ServiceManager from '@services/ServiceManager';
import { db } from '@database/db';
import NativeFile from '@specs/NativeFile';

/** Timeout (ms) for a single novel fetch from a source plugin */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve
 * within `ms` milliseconds, rejects with a timeout error.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timeout after ${ms}ms fetching ${label}`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

const updateNovelMetadata = async (
  pluginId: string,
  novelId: number,
  novel: SourceNovel,
) => {
  const { name, summary, author, artist, genres, status, totalPages } = novel;
  let cover = novel.cover;
  const novelDir = NOVEL_STORAGE + '/' + pluginId + '/' + novelId;
  if (!NativeFile.exists(novelDir)) {
    NativeFile.mkdir(novelDir);
  }
  if (cover) {
    const novelCoverPath = novelDir + '/cover.png';
    const novelCoverUri = 'file://' + novelCoverPath;
    downloadFile(cover, novelCoverPath, getPlugin(pluginId)?.imageRequestInit);
    cover = novelCoverUri + '?' + Date.now();
  }

  db.runSync(
    `UPDATE Novel SET
          name = ?, cover = ?, summary = ?, author = ?, artist = ?,
          genres = ?, status = ?, totalPages = ?
          WHERE id = ?
        `,
    [
      name,
      cover || null,
      summary || null,
      author || 'unknown',
      artist || null,
      genres || null,
      status || null,
      totalPages || 0,
      novelId,
    ],
  );
};

const updateNovelTotalPages = (novelId: number, totalPages: number) => {
  db.runSync('UPDATE Novel SET totalPages = ? WHERE id = ?', [
    totalPages,
    novelId,
  ]);
};

const CHAPTER_BATCH_SIZE = 50;

interface ChapterUpdateData {
  name: string;
  path: string;
  releaseTime: string | null;
  chapterPage: string;
  position: number;
  chapterNumber: number | null;
}

const updateNovelChapters = (
  novelName: string,
  novelId: number,
  chapters: ChapterItem[],
  downloadNewChapters?: boolean,
  page?: string,
) =>
  db.withTransactionAsync(async () => {
    // Mihon pattern: fetch existing chapters once, diff, then batch
    const existing = await db.getAllAsync<{
      id: number;
      path: string;
      name: string;
      releaseTime: string | null;
      chapterNumber: number | null;
      page: string;
      position: number;
    }>(
      'SELECT id, path, name, releaseTime, chapterNumber, page, position FROM Chapter WHERE novelId = ?',
      novelId,
    );
    const existingByPath = new Map(existing.map(ch => [ch.path, ch]));

    // Collect chapters for batch processing
    const chapterData: ChapterUpdateData[] = chapters.map(
      (chapter, position) => ({
        name: chapter.name ?? `Chapter ${position + 1}`,
        path: chapter.path,
        releaseTime: chapter.releaseTime || null,
        chapterPage: page || chapter.page || '1',
        position,
        chapterNumber: chapter.chapterNumber || null,
      }),
    );

    // Diff: separate new vs updated
    const toInsert: ChapterUpdateData[] = [];
    const toUpdate: Array<ChapterUpdateData & { id: number }> = [];

    for (const chapter of chapterData) {
      const ex = existingByPath.get(chapter.path);
      if (!ex) {
        toInsert.push(chapter);
      } else if (
        ex.name !== chapter.name ||
        ex.releaseTime !== chapter.releaseTime ||
        ex.page !== chapter.chapterPage ||
        ex.position !== chapter.position
      ) {
        toUpdate.push({ ...chapter, id: ex.id });
      }
    }

    // Batch INSERT new chapters using multi-value INSERT
    const newChapterIds: Array<{ chapterId: number; chapterName: string }> = [];

    for (let i = 0; i < toInsert.length; i += CHAPTER_BATCH_SIZE) {
      const batch = toInsert.slice(i, i + CHAPTER_BATCH_SIZE);
      const placeholders = batch
        .map(() => '(?, ?, ?, ?, datetime(\'now\',\'localtime\'), ?, ?, ?)')
        .join(', ');
      const params = batch.flatMap(ch => [
        ch.path, ch.name, ch.releaseTime, novelId,
        ch.chapterNumber, ch.chapterPage, ch.position,
      ]);

      const result = await db.runAsync(
        `INSERT INTO Chapter (path, name, releaseTime, novelId, updatedTime, chapterNumber, page, position) VALUES ${placeholders}`,
        ...params,
      );

      // For multi-value INSERT, lastInsertRowId is the LAST inserted row.
      // Rows are assigned sequential IDs, so we can calculate all of them.
      if (result.lastInsertRowId && result.changes > 0 && downloadNewChapters) {
        const firstId = result.lastInsertRowId - result.changes + 1;
        for (let j = 0; j < batch.length; j++) {
          newChapterIds.push({
            chapterId: firstId + j,
            chapterName: batch[j].name,
          });
        }
      }
    }

    // Batch UPDATE changed chapters
    for (let i = 0; i < toUpdate.length; i += CHAPTER_BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + CHAPTER_BATCH_SIZE);
      await Promise.all(
        batch.map(ch =>
          db.runAsync(
            `UPDATE Chapter SET
              name = ?, releaseTime = ?, updatedTime = datetime('now','localtime'), page = ?, position = ?
            WHERE id = ?`,
            ch.name, ch.releaseTime, ch.chapterPage, ch.position, ch.id,
          ),
        ),
      );
    }

    // Queue downloads for new chapters
    for (const { chapterId, chapterName } of newChapterIds) {
      ServiceManager.manager.addTask({
        name: 'DOWNLOAD_CHAPTER',
        data: { chapterId, novelName, chapterName },
      });
    }
  });

export interface UpdateNovelOptions {
  downloadNewChapters?: boolean;
  refreshNovelMetadata?: boolean;
}

const updateNovel = async (
  pluginId: string,
  novelPath: string,
  novelId: number,
  options: UpdateNovelOptions,
) => {
  if (pluginId === LOCAL_PLUGIN_ID) {
    return;
  }
  const { downloadNewChapters, refreshNovelMetadata } = options;
  const novel = await withTimeout(
    fetchNovel(pluginId, novelPath),
    FETCH_TIMEOUT_MS,
    `novel ${novelPath}`,
  );

  if (refreshNovelMetadata) {
    await updateNovelMetadata(pluginId, novelId, novel);
  } else if (novel.totalPages) {
    // at least update totalPages,
    updateNovelTotalPages(novelId, novel.totalPages);
  }

  await updateNovelChapters(
    novel.name,
    novelId,
    novel.chapters || [],
    downloadNewChapters,
  );
};

const updateNovelPage = async (
  pluginId: string,
  novelPath: string,
  novelName: string,
  novelId: number,
  page: string,
  options: Pick<UpdateNovelOptions, 'downloadNewChapters'>,
) => {
  const { downloadNewChapters } = options;
  const sourcePage = await fetchPage(pluginId, novelPath, page);
  await updateNovelChapters(
    novelName,
    novelId,
    sourcePage.chapters || [],
    downloadNewChapters,
    page,
  );
};

export { updateNovel, updateNovelPage };
