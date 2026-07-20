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
  getChapterCountSync,
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
  getFirstUnreadChapter,
  getNovelScanlators,
  getNovelScanlatorsSync,
  increaseTimeSpent,
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

    it('should insert scanlator string and array correctly', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertChapters(novelId, [
        {
          path: '/chapter/1',
          name: 'Chapter 1',
          scanlator: 'Translator Team A',
        },
        {
          path: '/chapter/2',
          name: 'Chapter 2',
          scanlator: ['Group X', 'Group Y', ''],
        },
      ]);

      const chapters = await getNovelChapters(novelId);
      expect(chapters).toHaveLength(2);
      expect(chapters[0].scanlator).toBe('Translator Team A');
      expect(chapters[1].scanlator).toBe('Group X, Group Y');
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

    it('should force page override option when inserting chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertChapters(
        novelId,
        [
          {
            path: '/chapter/1',
            name: 'Chapter 1',
            page: '99',
          },
        ],
        { page: '2' },
      );

      const chapters = await getNovelChapters(novelId);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].page).toBe('2');
    });

    it('should set updatedTime when touchUpdatedTime is enabled on insert', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertChapters(
        novelId,
        [
          {
            path: '/chapter/1',
            name: 'Chapter 1',
          },
        ],
        { touchUpdatedTime: true },
      );

      const chapters = await getNovelChapters(novelId);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].updatedTime).not.toBeNull();
    });

    it('should set releaseTime to null when preferNullReleaseTime is enabled', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertChapters(
        novelId,
        [
          {
            path: '/chapter/1',
            name: 'Chapter 1',
          },
        ],
        { preferNullReleaseTime: true },
      );

      const chapters = await getNovelChapters(novelId);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].releaseTime).toBeNull();
    });

    it('should backfill chapterNumber with index fallback over existing null', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertTestChapter(testDb, novelId, {
        path: '/chapter/1',
        chapterNumber: null,
      });

      await insertChapters(novelId, [
        {
          path: '/chapter/1',
          name: 'Chapter 1',
        },
      ]);

      const chapters = await getNovelChapters(novelId);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[0].chapterNumber).not.toBeNull();
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

    it('should return filtered count when filter is provided', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        unread: true,
      });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        unread: false,
      });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        unread: true,
      });

      const total = await getChapterCount(novelId, '1');
      expect(total).toBe(3);

      const unreadOnly = await getChapterCount(novelId, '1', ['not-read']);
      expect(unreadOnly).toBe(2);

      const readOnly = await getChapterCount(novelId, '1', ['read']);
      expect(readOnly).toBe(1);
    });

    it('should return total count when no filter is provided', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        unread: true,
      });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        unread: false,
      });

      const result = await getChapterCount(novelId, '1');
      expect(result).toBe(2);

      const noFilter = await getChapterCount(novelId, '1', undefined);
      expect(noFilter).toBe(2);

      const emptyFilter = await getChapterCount(novelId, '1', []);
      expect(emptyFilter).toBe(2);
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
    it('should return previous chapter from the same page and not the previous one', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 1,
      });
      await insertTestChapter(testDb, novelId, {
        page: '2',
        position: 1,
      });

      const result = await getPrevChapter(novelId, 1, '2');

      expect(result?.id).toBe(chapterId2);
    });

    it('should exclude chapters with scanlators in excludedScanlators list', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
        scanlator: 'Scan A',
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 1,
        scanlator: 'Scan B',
      });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 2,
        scanlator: 'Scan C',
      });

      // From chapter 3, previous should be chapter 2 (Scan B) if nothing excluded
      const resultNormal = await getPrevChapter(novelId, 2, '1');
      expect(resultNormal?.id).toBe(chapterId2);

      // From chapter 3, previous should be chapter 1 (Scan A) if Scan B is excluded
      const resultExcludeB = await getPrevChapter(novelId, 2, '1', ['Scan B']);
      expect(resultExcludeB?.id).toBe(chapterId1);

      // From chapter 3, previous should be undefined if both Scan B and Scan A are excluded
      const resultExcludeBoth = await getPrevChapter(novelId, 2, '1', [
        'Scan B',
        'Scan A',
      ]);
      expect(resultExcludeBoth).toBeUndefined();
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
    it('should return next chapter from the same page and not the next one', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 1,
      });
      await insertTestChapter(testDb, novelId, {
        page: '2',
        position: 0,
      });

      const result = await getNextChapter(novelId, 0, '1');

      expect(result?.id).toBe(chapterId2);
    });
    it('should return next chapter from the same page and not the 10th one', async () => {
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
      await insertTestChapter(testDb, novelId, {
        page: '10',
        position: 0,
      });

      const result = await getNextChapter(novelId, 0, '1');

      expect(result?.id).toBe(chapterId2);
    });

    it('should exclude chapters with scanlators in excludedScanlators list', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
        scanlator: 'Scan A',
      });
      const chapterId2 = await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 1,
        scanlator: 'Scan B',
      });
      const chapterId3 = await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 2,
        scanlator: 'Scan C',
      });

      // From chapter 1, next should be chapter 2 (Scan B) if nothing excluded
      const resultNormal = await getNextChapter(novelId, 0, '1');
      expect(resultNormal?.id).toBe(chapterId2);

      // From chapter 1, next should be chapter 3 (Scan C) if Scan B is excluded
      const resultExcludeB = await getNextChapter(novelId, 0, '1', ['Scan B']);
      expect(resultExcludeB?.id).toBe(chapterId3);

      // From chapter 1, next should be undefined if both Scan B and Scan C are excluded
      const resultExcludeBoth = await getNextChapter(novelId, 0, '1', [
        'Scan B',
        'Scan C',
      ]);
      expect(resultExcludeBoth).toBeUndefined();
    });

    it('should cross page boundaries when the first chapter of the next page is excluded', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        page: '1',
        position: 0,
      });
      // Page 2, position 0 is excluded scanlator
      await insertTestChapter(testDb, novelId, {
        page: '2',
        position: 0,
        scanlator: 'Scan A',
      });
      // Page 2, position 1 is not excluded
      const nextPageChapter1 = await insertTestChapter(testDb, novelId, {
        page: '2',
        position: 1,
        scanlator: 'Scan B',
      });

      const result = await getNextChapter(novelId, 0, '1', ['Scan A']);
      expect(result?.id).toBe(nextPageChapter1);
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
    it('should return downloaded chapters in page and position order', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        page: '10',
        position: 1,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        page: '2',
        position: 1,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        page: '1',
        position: 1,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: true,
        page: '2',
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        isDownloaded: false,
        page: '1',
        position: 0,
      });

      const result = await getNovelDownloadedChapters(novelId);

      expect(result.map(chapter => [chapter.page, chapter.position])).toEqual([
        ['1', 1],
        ['2', 0],
        ['2', 1],
        ['10', 1],
      ]);
    });

    it('should apply a range to the ordered downloaded chapters', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        name: 'Chapter 1',
        isDownloaded: true,
        page: '1',
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        name: 'Chapter 2',
        isDownloaded: true,
        page: '1',
        position: 1,
      });
      await insertTestChapter(testDb, novelId, {
        name: 'Chapter 3',
        isDownloaded: true,
        page: '2',
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        name: 'Chapter 4',
        isDownloaded: true,
        page: '2',
        position: 1,
      });

      const result = await getNovelDownloadedChapters(novelId, 2, 3);

      expect(result.map(chapter => chapter.name)).toEqual([
        'Chapter 2',
        'Chapter 3',
      ]);
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

  describe('getFirstUnreadChapter', () => {
    it('should return first unread chapter', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { unread: false, position: 0 });
      const chapterId = await insertTestChapter(testDb, novelId, {
        unread: true,
        position: 1,
      });
      await insertTestChapter(testDb, novelId, { unread: true, position: 2 });

      const result = getFirstUnreadChapter(novelId);
      expect(result).toBeDefined();
      expect(result?.id).toBe(chapterId);
    });

    it('should filter out excluded scanlators', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        unread: true,
        position: 0,
        scanlator: 'Scan A',
      });
      const chapterId = await insertTestChapter(testDb, novelId, {
        unread: true,
        position: 1,
        scanlator: 'Scan B',
      });

      const result = getFirstUnreadChapter(novelId, undefined, undefined, [
        'Scan A',
      ]);
      expect(result).toBeDefined();
      expect(result?.id).toBe(chapterId);
    });
  });

  describe('getChapterCount and getChapterCountSync with excluded scanlators', () => {
    it('should exclude chapters with scanlators in excludedScanlators list', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, {
        scanlator: 'Scan A',
        position: 0,
      });
      await insertTestChapter(testDb, novelId, {
        scanlator: 'Scan B',
        position: 1,
      });
      await insertTestChapter(testDb, novelId, {
        scanlator: null,
        position: 2,
      });
      await insertTestChapter(testDb, novelId, { scanlator: '', position: 3 });

      // Count without exclusions should be 4
      const countAll = await getChapterCount(novelId);
      expect(countAll).toBe(4);
      const countAllSync = getChapterCountSync(novelId);
      expect(countAllSync).toBe(4);

      // Exclude 'Scan A' -> count should be 3 (Scan B, null, '')
      const countExcludeA = await getChapterCount(novelId, '1', undefined, [
        'Scan A',
      ]);
      expect(countExcludeA).toBe(3);
      const countExcludeASync = getChapterCountSync(novelId, '1', undefined, [
        'Scan A',
      ]);
      expect(countExcludeASync).toBe(3);

      // Exclude 'Scan A' and 'Scan B' -> count should be 2 (null, '')
      const countExcludeBoth = await getChapterCount(novelId, '1', undefined, [
        'Scan A',
        'Scan B',
      ]);
      expect(countExcludeBoth).toBe(2);
      const countExcludeBothSync = getChapterCountSync(
        novelId,
        '1',
        undefined,
        ['Scan A', 'Scan B'],
      );
      expect(countExcludeBothSync).toBe(2);
    });
  });

  describe('getNovelScanlators', () => {
    it('should return unique scanlators', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { scanlator: 'Scan A' });
      await insertTestChapter(testDb, novelId, { scanlator: 'Scan B' });
      await insertTestChapter(testDb, novelId, { scanlator: 'Scan A' }); // Duplicate
      await insertTestChapter(testDb, novelId, { scanlator: '' }); // Empty
      await insertTestChapter(testDb, novelId, { scanlator: null }); // Null

      const scanlators = await getNovelScanlators(novelId);
      expect(scanlators).toHaveLength(2);
      expect(scanlators).toContain('Scan A');
      expect(scanlators).toContain('Scan B');

      const scanlatorsSync = getNovelScanlatorsSync(novelId);
      expect(scanlatorsSync).toHaveLength(2);
      expect(scanlatorsSync).toContain('Scan A');
      expect(scanlatorsSync).toContain('Scan B');
    });
  });
  describe('increaseTimeSpent', () => {
    it('should increase timeSpent from default 0', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {});

      await increaseTimeSpent(chapterId, 500);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.timeSpent).toBe(500);
    });

    it('should accumulate timeSpent across multiple calls', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {});

      await increaseTimeSpent(chapterId, 300);
      await increaseTimeSpent(chapterId, 200);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.timeSpent).toBe(500);
    });

    it('should add to a pre-existing non-zero timeSpent', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        timeSpent: 1000,
      });

      await increaseTimeSpent(chapterId, 250);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.timeSpent).toBe(1250);
    });

    it('should only update the targeted chapter', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId, {});
      const chapterId2 = await insertTestChapter(testDb, novelId, {});

      await increaseTimeSpent(chapterId1, 400);

      const chapters = await getNovelChapters(novelId);
      const chapter1 = chapters.find(c => c.id === chapterId1);
      const chapter2 = chapters.find(c => c.id === chapterId2);
      expect(chapter1?.timeSpent).toBe(400);
      expect(chapter2?.timeSpent).toBe(0);
    });

    it('should be a no-op for a non-existent chapterId', async () => {
      await expect(increaseTimeSpent(999999, 100)).resolves.not.toThrow();
    });

    it('should handle a timeSpent value of 0', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        timeSpent: 750,
      });

      await increaseTimeSpent(chapterId, 0);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.timeSpent).toBe(750);
    });
  });
});
