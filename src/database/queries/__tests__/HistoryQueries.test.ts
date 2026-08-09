/**
 * Tests for HistoryQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, insertTestChapter, clearAllTables } from './testData';

import {
  getHistoryFromDb,
  insertHistory,
  deleteChapterHistory,
  deleteNovelHistory,
  deleteAllHistory,
} from '../HistoryQueries';

describe('HistoryQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('getHistoryFromDb', () => {
    it('should return reading history grouped by novel', async () => {
      const testDb = getTestDb();

      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });

      const chapterId1 = await insertTestChapter(testDb, novelId1);
      const chapterId2 = await insertTestChapter(testDb, novelId2);

      await insertHistory(chapterId1);
      await insertHistory(chapterId2);

      const result = await getHistoryFromDb();

      expect(result.length).toBeGreaterThanOrEqual(2);
      const novelIds = result.map(h => h.novelId);
      expect(novelIds).toContain(novelId1);
      expect(novelIds).toContain(novelId2);
      expect(result.every(item => item.inLibrary)).toBe(true);
    });

    it('should return empty array when no history exists', async () => {
      const result = await getHistoryFromDb();

      expect(result).toEqual([]);
    });

    it('should only return chapters with readTime', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId);
      await insertTestChapter(testDb, novelId); // No readTime

      await insertHistory(chapterId1);

      const result = await getHistoryFromDb();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(chapterId1);
    });
  });

  describe('insertHistory', () => {
    it('should set readTime to current time', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        readTime: null,
      });

      await insertHistory(chapterId);

      const history = await getHistoryFromDb();
      const chapter = history.find(h => h.id === chapterId);
      expect(chapter?.readTime).toBeDefined();
      expect(chapter?.readTime).not.toBeNull();
    });
  });

  describe('deleteChapterHistory', () => {
    it('should remove chapter from history', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId);

      await insertHistory(chapterId);
      await deleteChapterHistory(chapterId);

      const history = await getHistoryFromDb();
      expect(history.find(h => h.id === chapterId)).toBeUndefined();
    });
  });

  describe('deleteNovelHistory', () => {
    it('should clear only the selected novel history', async () => {
      const testDb = getTestDb();

      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId1 = await insertTestChapter(testDb, novelId1);
      const chapterId2 = await insertTestChapter(testDb, novelId1);
      const chapterId3 = await insertTestChapter(testDb, novelId2);

      await insertHistory(chapterId1);
      await insertHistory(chapterId2);
      await insertHistory(chapterId3);
      await deleteNovelHistory(novelId1);

      const history = await getHistoryFromDb();
      expect(history.map(item => item.novelId)).not.toContain(novelId1);
      expect(history.map(item => item.novelId)).toContain(novelId2);
    });
  });

  describe('deleteAllHistory', () => {
    it('should clear all reading history', async () => {
      const testDb = getTestDb();

      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });

      const chapterId1 = await insertTestChapter(testDb, novelId1);
      const chapterId2 = await insertTestChapter(testDb, novelId2);

      await insertHistory(chapterId1);
      await insertHistory(chapterId2);
      await deleteAllHistory();

      const history = await getHistoryFromDb();
      expect(history).toEqual([]);
    });
  });
});
