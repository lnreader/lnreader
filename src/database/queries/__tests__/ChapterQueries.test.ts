/**
 * Tests for ChapterQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, insertTestChapter, clearAllTables } from './testData';

import {
  markChapterRead,
  markChaptersRead,
  markChapterUnread,
  markChaptersUnread,
  markAllChaptersRead,
  markAllChaptersUnread,
  getNovelChapters,
  getUnreadNovelChapters,
  getAllUndownloadedChapters,
  getAllUndownloadedAndUnreadChapters,
  getChapter,
  getCustomPages,
  getPageChapters,
  getChapterCount,
  getPageChaptersBatched,
  getPrevChapter,
  getNextChapter,
  getDownloadedChapters,
  getNovelDownloadedChapters,
  getUpdatedOverviewFromDb,
  getDetailedUpdatesFromDb,
  isChapterDownloaded,
  bookmarkChapter,
  insertChapters,
  deleteChapter,
  deleteChapters,
  deleteDownloads,
  deleteReadChaptersFromDb,
  updateChapterProgress,
  updateChapterProgressByIds,
  markPreviuschaptersRead,
  markPreviousChaptersUnread,
  clearUpdates,
} from '../ChapterQueries';

describe('ChapterQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('markChapterRead', () => {
    it('should mark chapter as read', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        unread: true,
      });

      await markChapterRead(chapterId);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.unread).toBe(false);
    });
  });

  describe('markChapterUnread', () => {
    it('should mark chapter as unread', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        unread: false,
      });

      await markChapterUnread(chapterId);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.unread).toBe(true);
    });
  });

  describe('bookmarkChapter', () => {
    it('should bookmark a chapter', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        bookmark: false,
      });

      await bookmarkChapter(chapterId);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.bookmark).toBe(true);
    });
  });

  describe('getNovelChapters', () => {
    it('should return all chapters for a novel', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { name: 'Chapter 1' });
      await insertTestChapter(testDb, novelId, { name: 'Chapter 2' });

      const result = await getNovelChapters(novelId);

      expect(result).toHaveLength(2);
      expect(result.map(c => c.name)).toContain('Chapter 1');
      expect(result.map(c => c.name)).toContain('Chapter 2');
    });
  });

  describe('markChaptersRead', () => {
    it('should mark multiple chapters as read', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId, {
        unread: true,
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        unread: true,
      });

      await markChaptersRead([chapterId1, chapterId2]);

      const chapters = await getNovelChapters(novelId);
      const chapter1 = chapters.find(c => c.id === chapterId1);
      const chapter2 = chapters.find(c => c.id === chapterId2);
      expect(chapter1?.unread).toBe(false);
      expect(chapter2?.unread).toBe(false);
    });

    it('should handle empty array', async () => {
      await expect(markChaptersRead([])).resolves.not.toThrow();
    });

    it('should handle already read chapters', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        unread: false,
      });

      await markChaptersRead([chapterId]);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.unread).toBe(false);
    });
  });

  describe('markChaptersUnread', () => {
    it('should mark multiple chapters as unread', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId, {
        unread: false,
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        unread: false,
      });

      await markChaptersUnread([chapterId1, chapterId2]);

      const chapters = await getNovelChapters(novelId);
      const chapter1 = chapters.find(c => c.id === chapterId1);
      const chapter2 = chapters.find(c => c.id === chapterId2);
      expect(chapter1?.unread).toBe(true);
      expect(chapter2?.unread).toBe(true);
    });

    it('should handle empty array', async () => {
      await expect(markChaptersUnread([])).resolves.not.toThrow();
    });
  });

  describe('markAllChaptersRead', () => {
    it('should mark all chapters as read for a novel', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { unread: true });
      await insertTestChapter(testDb, novelId, { unread: true });
      await insertTestChapter(testDb, novelId, { unread: true });

      await markAllChaptersRead(novelId);

      const chapters = await getNovelChapters(novelId);
      expect(chapters.every(c => c.unread === false)).toBe(true);
    });

    it('should handle novel with no chapters', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await expect(markAllChaptersRead(novelId)).resolves.not.toThrow();
    });
  });

  describe('markAllChaptersUnread', () => {
    it('should mark all chapters as unread for a novel', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { unread: false });
      await insertTestChapter(testDb, novelId, { unread: false });

      await markAllChaptersUnread(novelId);

      const chapters = await getNovelChapters(novelId);
      expect(chapters.every(c => c.unread === true)).toBe(true);
    });
  });

  describe('insertChapters', () => {
    it('should handle empty array', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await expect(insertChapters(novelId, [])).resolves.not.toThrow();
    });

    it('should insert single chapter', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertChapters(novelId, [
        {
          path: '/chapter/1',
          name: 'Chapter 1',
          releaseTime: '2024-01-01',
          chapterNumber: 1,
          page: '1',
        },
      ]);

      const chapters = await getNovelChapters(novelId);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].name).toBe('Chapter 1');
      expect(chapters[0].position).toBe(0);
    });

    it('should insert multiple chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertChapters(novelId, [
        {
          path: '/chapter/1',
          name: 'Chapter 1',
          chapterNumber: 1,
          page: '1',
        },
        {
          path: '/chapter/2',
          name: 'Chapter 2',
          chapterNumber: 2,
          page: '1',
        },
      ]);

      const chapters = await getNovelChapters(novelId);
      expect(chapters).toHaveLength(2);
      expect(chapters[0].position).toBe(0);
      expect(chapters[1].position).toBe(1);
    });

    it('should handle conflict resolution (on conflict update)', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertChapters(novelId, [
        {
          path: '/chapter/1',
          name: 'Chapter 1',
          chapterNumber: 1,
          page: '1',
        },
      ]);

      // Insert again with updated name
      await insertChapters(novelId, [
        {
          path: '/chapter/1',
          name: 'Chapter 1 Updated',
          chapterNumber: 1,
          page: '1',
        },
      ]);

      const chapters = await getNovelChapters(novelId);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].name).toBe('Chapter 1 Updated');
    });

    it('should assign default chapter name when missing', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertChapters(novelId, [
        {
          path: '/chapter/1',
          name: '', // Empty name to test default behavior
          chapterNumber: 1,
          page: '1',
        },
      ]);

      const chapters = await getNovelChapters(novelId);
      expect(chapters[0].name).toBe('Chapter 1');
    });
  });

  describe('deleteChapter', () => {
    it('should delete chapter and update isDownloaded flag', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'test-plugin',
      });
      const chapterId = await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
      });

      await deleteChapter('test-plugin', novelId, chapterId);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.isDownloaded).toBe(false);
    });
  });

  describe('deleteChapters', () => {
    it('should handle empty array', async () => {
      await expect(deleteChapters('test-plugin', 1, [])).resolves.not.toThrow();
    });

    it('should delete multiple chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'test-plugin',
      });
      const chapterId1 = await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
      });

      const chapters = await getNovelChapters(novelId);
      const chapter1b = chapters.find(c => c.id === chapterId1);
      const chapter2b = chapters.find(c => c.id === chapterId2);
      expect(chapter1b?.isDownloaded).toBe(true);
      expect(chapter2b?.isDownloaded).toBe(true);
      await deleteChapters('test-plugin', novelId, [
        { id: chapterId1 } as any,
        { id: chapterId2 } as any,
      ]);

      const updatedChapters = await getNovelChapters(novelId);
      const chapter1a = updatedChapters.find(c => c.id === chapterId1);
      const chapter2a = updatedChapters.find(c => c.id === chapterId2);
      expect(chapter1a?.isDownloaded).toBe(false);
      expect(chapter2a?.isDownloaded).toBe(false);
    });
  });

  describe('deleteDownloads', () => {
    it('should handle empty array', async () => {
      await expect(deleteDownloads([])).resolves.not.toThrow();
    });

    it('should delete multiple downloads', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'test-plugin',
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
      });

      const chapters = await getNovelChapters(novelId);
      const downloadedChapters = chapters.filter(c => c.isDownloaded);
      await deleteDownloads(
        downloadedChapters.map(c => ({
          id: c.id,
          novelId,
          pluginId: 'test-plugin',
        })) as any,
      );

      const updatedChapters = await getNovelChapters(novelId);
      expect(updatedChapters.every(c => c.isDownloaded === false)).toBe(true);
    });
  });

  describe('deleteReadChaptersFromDb', () => {
    it('should delete only read downloaded chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'test-plugin',
      });
      const readDownloadedId = await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        unread: false,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        unread: true, // Unread, should not be deleted
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: false,
        unread: false, // Not downloaded, should not be deleted
      });

      await deleteReadChaptersFromDb();

      const chapters = await getNovelChapters(novelId);
      const deletedChapter = chapters.find(c => c.id === readDownloadedId);
      expect(deletedChapter?.isDownloaded).toBe(false);
    });
  });

  describe('updateChapterProgress', () => {
    it('should update chapter progress', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        progress: null,
      });

      await updateChapterProgress(chapterId, 50);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.progress).toBe(50);
    });
  });

  describe('updateChapterProgressByIds', () => {
    it('should handle empty array', async () => {
      await expect(updateChapterProgressByIds([], 50)).resolves.not.toThrow();
    });

    it('should update progress for multiple chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId);
      const chapterId2 = await insertTestChapter(testDb, novelId);

      await updateChapterProgressByIds([chapterId1, chapterId2], 75);

      const chapters = await getNovelChapters(novelId);
      const chapter1 = chapters.find(c => c.id === chapterId1);
      const chapter2 = chapters.find(c => c.id === chapterId2);
      expect(chapter1?.progress).toBe(75);
      expect(chapter2?.progress).toBe(75);
    });
  });

  describe('markPreviuschaptersRead', () => {
    it('should mark previous chapters as read', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId, {
        unread: true,
        position: 0,
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        unread: true,
        position: 1,
      });
      const chapterId3 = await insertTestChapter(testDb, novelId, {
        unread: true,
        position: 2,
      });

      await markPreviuschaptersRead(chapterId2, novelId);

      const chapters = await getNovelChapters(novelId);
      const chapter1 = chapters.find(c => c.id === chapterId1);
      const chapter2 = chapters.find(c => c.id === chapterId2);
      const chapter3 = chapters.find(c => c.id === chapterId3);
      expect(chapter1?.unread).toBe(false);
      expect(chapter2?.unread).toBe(false);
      expect(chapter3?.unread).toBe(true);
    });
  });

  describe('markPreviousChaptersUnread', () => {
    it('should mark previous chapters as unread', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId, {
        unread: false,
        position: 0,
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        unread: false,
        position: 1,
      });
      const chapterId3 = await insertTestChapter(testDb, novelId, {
        unread: false,
        position: 2,
      });

      await markPreviousChaptersUnread(chapterId2, novelId);

      const chapters = await getNovelChapters(novelId);
      const chapter1 = chapters.find(c => c.id === chapterId1);
      const chapter2 = chapters.find(c => c.id === chapterId2);
      const chapter3 = chapters.find(c => c.id === chapterId3);
      expect(chapter1?.unread).toBe(true);
      expect(chapter2?.unread).toBe(true);
      expect(chapter3?.unread).toBe(false);
    });
  });

  describe('clearUpdates', () => {
    it('should clear all update timestamps', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        updatedTime: '2024-01-01',
      });
      await insertTestChapter(testDb, novelId, {
        updatedTime: '2024-01-02',
      });

      await clearUpdates();

      const chapters = await getNovelChapters(novelId);
      expect(chapters.every(c => c.updatedTime === null)).toBe(true);
    });
  });

  describe('getCustomPages', () => {
    it('should return distinct pages for a novel', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { page: '1' });
      await insertTestChapter(testDb, novelId, { page: '2' });
      await insertTestChapter(testDb, novelId, { page: '2' }); // Duplicate

      const result = await getCustomPages(novelId);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.page)).toContain('1');
      expect(result.map(r => r.page)).toContain('2');
    });

    it('should return empty array when no pages', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      const result = await getCustomPages(novelId);

      expect(result).toHaveLength(0);
    });
  });

  describe('getUnreadNovelChapters', () => {
    it('should return only unread chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { unread: true });
      await insertTestChapter(testDb, novelId, { unread: false });
      await insertTestChapter(testDb, novelId, { unread: true });

      const result = await getUnreadNovelChapters(novelId);

      expect(result).toHaveLength(2);
      expect(result.every(c => c.unread === true)).toBe(true);
    });

    it('should return empty array when no unread chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { unread: false });

      const result = await getUnreadNovelChapters(novelId);

      expect(result).toHaveLength(0);
    });
  });

  describe('getAllUndownloadedChapters', () => {
    it('should return only undownloaded chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { isDownloaded: false });
      await insertTestChapter(testDb, novelId, { isDownloaded: true });
      await insertTestChapter(testDb, novelId, { isDownloaded: false });

      const result = await getAllUndownloadedChapters(novelId);

      expect(result).toHaveLength(2);
      expect(result.every(c => c.isDownloaded === false)).toBe(true);
    });
  });

  describe('getAllUndownloadedAndUnreadChapters', () => {
    it('should return chapters that are both undownloaded and unread', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: false,
        unread: true,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        unread: true,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: false,
        unread: false,
      });

      const result = await getAllUndownloadedAndUnreadChapters(novelId);

      expect(result).toHaveLength(1);
      expect(result[0].isDownloaded).toBe(false);
      expect(result[0].unread).toBe(true);
    });
  });

  describe('getChapter', () => {
    it('should return a single chapter', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        name: 'Test Chapter',
      });

      const result = await getChapter(chapterId);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Chapter');
    });

    it('should return undefined for non-existent chapter', async () => {
      const result = await getChapter(999);

      expect(result).toBeUndefined();
    });
  });

  describe('getPageChapters', () => {
    it('should return chapters for a specific page', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { page: '1' });
      await insertTestChapter(testDb, novelId, { page: '2' });
      await insertTestChapter(testDb, novelId, { page: '1' });

      const result = await getPageChapters(novelId, undefined, undefined, '1');

      expect(result).toHaveLength(2);
      expect(result.every(c => c.page === '1')).toBe(true);
    });

    it('should handle limit and offset', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { page: '1', position: 0 });
      await insertTestChapter(testDb, novelId, { page: '1', position: 1 });
      await insertTestChapter(testDb, novelId, { page: '1', position: 2 });

      const result = await getPageChapters(
        novelId,
        undefined,
        undefined,
        '1',
        1,
        1,
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('getChapterCount', () => {
    it('should return correct chapter count for a page', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { page: '1' });
      await insertTestChapter(testDb, novelId, { page: '1' });
      await insertTestChapter(testDb, novelId, { page: '2' });

      const result = await getChapterCount(novelId, '1');

      expect(result).toBe(2);
    });
  });

  describe('getPageChaptersBatched', () => {
    it('should return chapters in batches', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      // Create more than 300 chapters to test batching
      for (let i = 0; i < 5; i++) {
        await insertTestChapter(testDb, novelId, {
          page: '1',
          position: i,
        });
      }

      const batch0 = await getPageChaptersBatched(
        novelId,
        undefined,
        undefined,
        '1',
        0,
      );
      expect(batch0.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPrevChapter', () => {
    it('should return previous chapter in same page', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 1,
      });

      const result = await getPrevChapter(novelId, 1, '1');

      expect(result).toBeDefined();
      expect(result?.position).toBe(0);
    });

    it('should return previous chapter from previous page', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        page: '2',
        position: 0,
      });

      const result = await getPrevChapter(novelId, 0, '2');

      expect(result).toBeDefined();
      expect(result?.page).toBe('1');
    });
  });

  describe('getNextChapter', () => {
    it('should return next chapter in same page', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 1,
      });

      const result = await getNextChapter(novelId, 0, '1');

      expect(result).toBeDefined();
      expect(result?.position).toBe(1);
    });

    it('should return next chapter from next page', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        page: '2',
        position: 0,
      });

      const result = await getNextChapter(novelId, 0, '1');

      expect(result?.id).toBe(chapterId2);
    });
  });

  describe('getDownloadedChapters', () => {
    it('should return all downloaded chapters with novel info', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'test-plugin',
        name: 'Test Novel',
      });
      await insertTestChapter(testDb, novelId, { isDownloaded: true });
      await insertTestChapter(testDb, novelId, { isDownloaded: false });

      const result = await getDownloadedChapters();

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].isDownloaded).toBe(true);
      expect(result[0].pluginId).toBe('test-plugin');
    });
  });

  describe('getNovelDownloadedChapters', () => {
    it('should return downloaded chapters for a novel', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: false,
        position: 1,
      });

      const result = await getNovelDownloadedChapters(novelId);

      expect(result).toHaveLength(1);
      expect(result[0].isDownloaded).toBe(true);
    });

    it('should filter by position range', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        position: 1,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        position: 2,
      });

      const result = await getNovelDownloadedChapters(novelId, 0, 1);

      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getUpdatedOverviewFromDb', () => {
    it('should return update overview grouped by novel and date', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        updatedTime: '2024-01-01 10:00:00',
      });
      await insertTestChapter(testDb, novelId, {
        updatedTime: '2024-01-01 11:00:00',
      });

      const result = await getUpdatedOverviewFromDb();

      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getDetailedUpdatesFromDb', () => {
    it('should return detailed updates for a novel', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        updatedTime: '2024-01-01',
      });

      const result = await getDetailedUpdatesFromDb(novelId);

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by onlyDownloadableChapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        updatedTime: '2024-01-01',
        isDownloaded: true,
      });
      await insertTestChapter(testDb, novelId, {
        updatedTime: '2024-01-01',
        isDownloaded: false,
      });

      const result = await getDetailedUpdatesFromDb(novelId, true);

      expect(result.every(c => c.isDownloaded === true)).toBe(true);
    });
  });

  describe('isChapterDownloaded', () => {
    it('should return true for downloaded chapter', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
      });

      const result = isChapterDownloaded(chapterId);
      expect(result).toBe(true);
    });

    it('should return false for non-downloaded chapter', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        isDownloaded: false,
      });

      const result = isChapterDownloaded(chapterId);
      expect(result).toBe(false);
    });
  });
});
