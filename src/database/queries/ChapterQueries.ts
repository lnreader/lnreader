import { showToast } from '@utils/showToast';
import {
  ChapterInfo,
  DownloadedChapter,
  UpdateOverview,
  Update,
} from '../types';
import { ChapterItem } from '@plugins/types';

import { getString } from '@strings/translations';
import { NOVEL_STORAGE } from '@utils/Storages';
import { db } from '@database/db';
import NativeFile from '@specs/NativeFile';

// #region Mutations

/**
 * Batch size for chapter INSERT/UPDATE operations.
 * Matches Mihon's approach of chunking large chapter lists.
 */
const CHAPTER_BATCH_SIZE = 100;

/**
 * Insert or update chapters for a novel.
 * Inspired by Mihon's SyncChaptersWithSource:
 * 1. Fetch existing chapters by novelId in one query
 * 2. Diff: determine which are new vs need updating
 * 3. Batch INSERT new chapters
 * 4. Batch UPDATE changed chapters
 * This is dramatically faster than N individual INSERT+SELECT queries.
 */
export const insertChapters = async (
  novelId: number,
  chapters?: ChapterItem[],
) => {
  if (!chapters?.length) {
    return;
  }

  await db.withTransactionAsync(async () => {
    // Step 1: Fetch all existing chapters for this novel in ONE query
    const existing = await db.getAllAsync<{
      id: number;
      path: string;
      name: string;
      releaseTime: string;
      chapterNumber: number | null;
      page: string;
      position: number;
    }>(
      'SELECT id, path, name, releaseTime, chapterNumber, page, position FROM Chapter WHERE novelId = ?',
      novelId,
    );
    const existingByPath = new Map(existing.map(ch => [ch.path, ch]));

    // Step 2: Diff — separate new chapters from updates
    const toInsert: Array<{
      path: string;
      name: string;
      releaseTime: string;
      chapterNumber: number | null;
      page: string;
      position: number;
    }> = [];
    const toUpdate: Array<{
      id: number;
      name: string;
      releaseTime: string;
      chapterNumber: number | null;
      page: string;
      position: number;
    }> = [];

    for (let index = 0; index < chapters.length; index++) {
      const chapter = chapters[index];
      const name = chapter.name ?? 'Chapter ' + (index + 1);
      const page = chapter.page || '1';
      const releaseTime = chapter.releaseTime || '';
      const chapterNumber = chapter.chapterNumber || null;

      const ex = existingByPath.get(chapter.path);
      if (!ex) {
        toInsert.push({ path: chapter.path, name, releaseTime, chapterNumber, page, position: index });
      } else if (
        ex.name !== name ||
        ex.releaseTime !== releaseTime ||
        ex.chapterNumber !== chapterNumber ||
        ex.page !== page ||
        ex.position !== index
      ) {
        toUpdate.push({ id: ex.id, name, releaseTime, chapterNumber, page, position: index });
      }
    }

    // Step 3: Batch INSERT new chapters
    for (let i = 0; i < toInsert.length; i += CHAPTER_BATCH_SIZE) {
      const batch = toInsert.slice(i, i + CHAPTER_BATCH_SIZE);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = batch.flatMap(ch => [
        ch.path, ch.name, ch.releaseTime, novelId,
        ch.chapterNumber, ch.page, ch.position,
      ]);
      await db.runAsync(
        `INSERT INTO Chapter (path, name, releaseTime, novelId, chapterNumber, page, position) VALUES ${placeholders}`,
        ...params,
      );
    }

    // Step 4: Batch UPDATE changed chapters (individual updates but batched in Promise.all)
    for (let i = 0; i < toUpdate.length; i += CHAPTER_BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + CHAPTER_BATCH_SIZE);
      await Promise.all(
        batch.map(ch =>
          db.runAsync(
            'UPDATE Chapter SET page = ?, position = ?, name = ?, releaseTime = ?, chapterNumber = ? WHERE id = ?',
            ch.page, ch.position, ch.name, ch.releaseTime, ch.chapterNumber, ch.id,
          ),
        ),
      );
    }
  });
};

export const markChapterRead = (chapterId: number) =>
  db.runAsync('UPDATE Chapter SET `unread` = 0 WHERE id = ?', chapterId);

export const markChaptersRead = (chapterIds: number[]) =>
  db.execAsync(
    `UPDATE Chapter SET \`unread\` = 0 WHERE id IN (${chapterIds.join(',')})`,
  );

export const markChapterUnread = (chapterId: number) =>
  db.runAsync('UPDATE Chapter SET `unread` = 1 WHERE id = ?', chapterId);

export const markChaptersUnread = (chapterIds: number[]) =>
  db.execAsync(
    `UPDATE Chapter SET \`unread\` = 1 WHERE id IN (${chapterIds.join(',')})`,
  );

export const markAllChaptersRead = (novelId: number) =>
  db.runAsync('UPDATE Chapter SET `unread` = 0 WHERE novelId = ?', novelId);

export const markAllChaptersUnread = (novelId: number) =>
  db.runAsync('UPDATE Chapter SET `unread` = 1 WHERE novelId = ?', novelId);

/**
 * Safely delete downloaded chapter files from disk.
 * If the folder doesn't exist (already deleted or never downloaded),
 * we silently skip — this is intentional and mirrors Mihon's behavior.
 * File I/O errors should never crash the app or abort a batch operation.
 */
const deleteDownloadedFiles = (
  pluginId: string,
  novelId: number,
  chapterId: number,
): boolean => {
  try {
    const chapterFolder = `${NOVEL_STORAGE}/${pluginId}/${novelId}/${chapterId}`;
    if (NativeFile.exists(chapterFolder)) {
      NativeFile.unlink(chapterFolder);
    }
    return true;
  } catch {
    // Log but don't throw — one failed file deletion shouldn't abort the entire batch
    // eslint-disable-next-line no-console
    console.warn(
      `Failed to delete chapter files: ${pluginId}/${novelId}/${chapterId}`,
    );
    return false;
  }
};

/**
 * Bulk-delete downloaded chapter files. Processes all chapters and
 * collects failures instead of stopping at the first error.
 * Returns the number of chapters whose files were successfully removed.
 */
const bulkDeleteDownloadedFiles = (
  chapters: Array<{ pluginId: string; novelId: number; id: number }>,
): number => {
  let deleted = 0;
  for (const ch of chapters) {
    if (deleteDownloadedFiles(ch.pluginId, ch.novelId, ch.id)) {
      deleted++;
    }
  }
  return deleted;
};

// delete downloaded chapter
export const deleteChapter = async (
  pluginId: string,
  novelId: number,
  chapterId: number,
) => {
  deleteDownloadedFiles(pluginId, novelId, chapterId);
  await db.runAsync(
    'UPDATE Chapter SET isDownloaded = 0 WHERE id = ?',
    chapterId,
  );
};

export const deleteChapters = async (
  pluginId: string,
  novelId: number,
  chapters?: ChapterInfo[],
) => {
  if (!chapters?.length) {
    return;
  }

  bulkDeleteDownloadedFiles(
    chapters.map(ch => ({ pluginId, novelId, id: ch.id })),
  );

  const chapterIdsString = chapters.map(chapter => chapter.id).join(',');
  await db.execAsync(
    `UPDATE Chapter SET isDownloaded = 0 WHERE id IN (${chapterIdsString})`,
  );
};

export const deleteDownloads = async (chapters: DownloadedChapter[]) => {
  if (!chapters?.length) {
    return;
  }

  bulkDeleteDownloadedFiles(chapters);
  await db.execAsync('UPDATE Chapter SET isDownloaded = 0');
};

export const deleteReadChaptersFromDb = async () => {
  try {
    const chapters = await getReadDownloadedChapters();

    if (!chapters?.length) {
      showToast(getString('novelScreen.readChaptersDeleted'));
      return;
    }

    // Delete files from disk (safe — won't throw)
    bulkDeleteDownloadedFiles(chapters);

    // Mark as not-downloaded in DB
    const chapterIds = chapters.map(chapter => chapter.id).join(',');
    await db.execAsync(
      `UPDATE Chapter SET isDownloaded = 0 WHERE id IN (${chapterIds})`,
    );

    showToast(getString('novelScreen.readChaptersDeleted'));
  } catch (error: any) {
    showToast(
      getString('novelScreen.deleteChapterError') +
        ': ' +
        (error?.message || String(error)),
    );
  }
};

export const updateChapterProgress = (chapterId: number, progress: number) =>
  db.runAsync(
    'UPDATE Chapter SET progress = ? WHERE id = ?',
    progress,
    chapterId,
  );

export const updateChapterProgressByIds = (
  chapterIds: number[],
  progress: number,
) =>
  db.runAsync(
    `UPDATE Chapter SET progress = ? WHERE id in (${chapterIds.join(',')})`,
    progress,
  );

export const bookmarkChapter = (chapterId: number) =>
  db.runAsync(
    'UPDATE Chapter SET bookmark = (CASE WHEN bookmark = 0 THEN 1 ELSE 0 END) WHERE id = ?',
    chapterId,
  );

export const markPreviuschaptersRead = (chapterId: number, novelId: number) =>
  db.runAsync(
    'UPDATE Chapter SET `unread` = 0 WHERE id <= ? AND novelId = ?',
    chapterId,
    novelId,
  );

export const markPreviousChaptersUnread = (
  chapterId: number,
  novelId: number,
) =>
  db.runAsync(
    'UPDATE Chapter SET `unread` = 1 WHERE id <= ? AND novelId = ?',
    chapterId,
    novelId,
  );

export const clearUpdates = () =>
  db.execAsync('UPDATE Chapter SET updatedTime = NULL');

// #endregion
// #region Selectors

export const getCustomPages = (novelId: number) =>
  db.getAllSync<{ page: string }>(
    'SELECT DISTINCT page from Chapter WHERE novelId = ?',
    novelId,
  );

export const getNovelChapters = (novelId: number) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ?',
    novelId,
  );

export const getUnreadNovelChapters = (novelId: number) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND unread = 1',
    novelId,
  );

export const getAllUndownloadedChapters = (novelId: number) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 0',
    novelId,
  );

export const getAllUndownloadedAndUnreadChapters = (novelId: number) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 0 AND unread = 1',
    novelId,
  );

export const getChapter = (chapterId: number) =>
  db.getFirstAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE id = ?',
    chapterId,
  );

const getPageChaptersQuery = (
  sort = 'ORDER BY position ASC',
  filter = '',
  limit?: number,
  offset?: number,
) =>
  `
    SELECT * FROM Chapter 
    WHERE novelId = ? AND page = ? 
    ${filter} ${sort} 
    ${limit ? `LIMIT ${limit}` : ''} 
    ${offset ? `OFFSET ${offset}` : ''}`;

export const getPageChapters = (
  novelId: number,
  sort?: string,
  filter?: string,
  page?: string,
  offset?: number,
  limit?: number,
) => {
  return db.getAllAsync<ChapterInfo>(
    getPageChaptersQuery(sort, filter, limit, offset),
    novelId,
    page || '1',
  );
};

export const getChapterCount = (novelId: number, page: string = '1') =>
  db.getFirstSync<{ 'COUNT(*)': number }>(
    'SELECT COUNT(*) FROM Chapter WHERE novelId = ? AND page = ?',
    novelId,
    page,
  )?.['COUNT(*)'] ?? 0;

export const getPageChaptersBatched = (
  novelId: number,
  sort?: string,
  filter?: string,
  page?: string,
  batch: number = 0,
) => {
  return db.getAllSync<ChapterInfo>(
    getPageChaptersQuery(sort, filter, 300, 300 * batch),
    novelId,
    page || '1',
  );
};

export const getPrevChapter = (
  novelId: number,
  chapterPosition: number,
  page: string,
) =>
  db.getFirstAsync<ChapterInfo>(
    `SELECT * FROM Chapter 
      WHERE novelId = ? 
      AND (
        (position < ? AND page = ?) 
        OR page < ?
      )
      ORDER BY position DESC, page DESC`,
    novelId,
    chapterPosition,
    page,
    page,
  );

export const getNextChapter = (
  novelId: number,
  chapterPosition: number,
  page: string,
) =>
  db.getFirstAsync<ChapterInfo>(
    `SELECT * FROM Chapter 
      WHERE novelId = ? 
      AND (
        (page = ? AND position > ?)  
        OR (position = 0 AND page > ?) 
      )
      ORDER BY position ASC, page ASC`,
    novelId,
    page,
    chapterPosition,
    page,
  );

const getReadDownloadedChapters = () =>
  db.getAllAsync<DownloadedChapter>(`
        SELECT Chapter.id, Chapter.novelId, pluginId 
        FROM Chapter
        JOIN Novel
        ON Novel.id = Chapter.novelId AND unread = 0 AND isDownloaded = 1`);

export const getDownloadedChapters = () =>
  db.getAllAsync<DownloadedChapter>(`
    SELECT
      Chapter.*,
      Novel.pluginId, Novel.name as novelName, Novel.cover as novelCover, Novel.path as novelPath
    FROM Chapter
    JOIN Novel
    ON Chapter.novelId = Novel.id
    WHERE Chapter.isDownloaded = 1
  `);

export const getNovelDownloadedChapters = (
  novelId: number,
  startPosition?: number,
  endPosition?: number,
) => {
  if (startPosition !== undefined && endPosition !== undefined) {
    return db.getAllAsync<ChapterInfo>(
      'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 AND position >= ? AND position <= ? ORDER BY position ASC',
      novelId,
      startPosition - 1,
      endPosition - 1,
    );
  }

  return db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 ORDER BY position ASC',
    novelId,
  );
};

export const getUpdatedOverviewFromDb = () =>
  db.getAllAsync<UpdateOverview>(`SELECT
  Novel.id AS novelId,
  Novel.name AS novelName,
  Novel.cover AS novelCover,
  Novel.path AS novelPath,
  DATE(Chapter.updatedTime) AS updateDate,
  COUNT(*) AS updatesPerDay
FROM
  Chapter
JOIN
  Novel
ON
  Chapter.novelId = Novel.id
WHERE
  Chapter.updatedTime IS NOT NULL
GROUP BY
  Novel.id,
  DATE(Chapter.updatedTime)
ORDER BY
  updateDate DESC,
  novelId;
`);

export const getDetailedUpdatesFromDb = async (
  novelId: number,
  onlyDownloadableChapters?: boolean,
) => {
  const result = db.getAllAsync<Update>(
    `
SELECT
  Chapter.*,
  pluginId, Novel.id as novelId, Novel.name as novelName, Novel.path as novelPath, cover as novelCover
FROM
  Chapter
JOIN
  Novel
  ON Chapter.novelId = Novel.id
WHERE novelId = ?  ${
      onlyDownloadableChapters
        ? 'AND Chapter.isDownloaded = 1 '
        : 'AND updatedTime IS NOT NULL'
    }
ORDER BY updatedTime DESC; 
`,
    novelId,
  );

  return await result;
};

export const isChapterDownloaded = (chapterId: number) =>
  !!db.getFirstSync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE id = ? AND isDownloaded = 1',
    chapterId,
  );
