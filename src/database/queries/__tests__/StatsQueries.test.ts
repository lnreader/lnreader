/**
 * Tests for StatsQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import {
  insertTestNovel,
  insertTestChapter,
  clearAllTables,
  insertTestNovelCategory,
  insertTestCategory,
} from './testData';

import {
  getAggregateStatsFromDb,
  getTopCategoriesByTimeSpentFromDb,
  getTopNovelsByTimeSpentFromDb,
} from '../StatsQueries';

describe('StatsQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('getAggregateStatsFromDb', () => {
    it('should return counts, totals, and chapter stats from Novel pre-computed columns', async () => {
      const testDb = getTestDb();

      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'source1',
        totalChapters: 10,
        chaptersDownloaded: 3,
        chaptersUnread: 2,
      });

      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'source2',
        totalChapters: 5,
        chaptersDownloaded: 1,
        chaptersUnread: 5,
      });

      // Add chapters with timeSpent to test totalTimeSpent
      await insertTestChapter(testDb, novelId1, { timeSpent: 100 });
      await insertTestChapter(testDb, novelId1, { timeSpent: 200 });
      await insertTestChapter(testDb, novelId2, { timeSpent: 300 });

      // Novel not in library should be ignored
      const nonLibNovelId = await insertTestNovel(testDb, {
        inLibrary: false,
        pluginId: 'source3',
        totalChapters: 99,
        chaptersDownloaded: 99,
        chaptersUnread: 99,
      });
      await insertTestChapter(testDb, nonLibNovelId, { timeSpent: 999 });

      const result = await getAggregateStatsFromDb();

      // Triggers auto-increment totalChapters (1 per chapter insert) and chaptersUnread (1 per unread chapter insert)
      // novelId1: totalChapters 10 -> 12 (2 chapters inserted), chaptersUnread 2 -> 4
      // novelId2: totalChapters 5 -> 6 (1 chapter inserted), chaptersUnread 5 -> 6
      expect(result.novelsCount).toBe(2);
      expect(result.sourcesCount).toBe(2);
      expect(result.chaptersCount).toBe(18); // (10+2) + (5+1) = 18
      expect(result.chaptersDownloaded).toBe(4); // 3 + 1, trigger doesn't add (default isDownloaded=false)
      expect(result.chaptersUnread).toBe(10); // (2+2) + (5+1) = 10
      expect(result.chaptersRead).toBe(8); // 18 - 10 = 8
      expect(result.totalTimeSpent).toBe(600); // 100 + 200 + 300
    });

    it('should return zeros when library is empty', async () => {
      const result = await getAggregateStatsFromDb();

      expect(result.novelsCount).toBe(0);
      expect(result.sourcesCount).toBe(0);
      expect(result.chaptersCount).toBe(0);
      expect(result.chaptersDownloaded).toBe(0);
      expect(result.chaptersUnread).toBe(0);
      expect(result.chaptersRead).toBe(0);
      expect(result.totalTimeSpent).toBe(0);
    });

    it('should only count in-library novels', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { inLibrary: true });
      await insertTestNovel(testDb, { inLibrary: true });
      await insertTestNovel(testDb, { inLibrary: false });
      await insertTestNovel(testDb, { inLibrary: false });

      const result = await getAggregateStatsFromDb();

      expect(result.novelsCount).toBe(2);
    });
  });
  describe('getTopNovelsByTimeSpentFromDb', () => {
    it('should return top novels ordered by total time spent descending', async () => {
      const testDb = getTestDb();

      const novelId1 = await insertTestNovel(testDb, {
        name: 'Novel A',
        inLibrary: true,
      });
      await insertTestChapter(testDb, novelId1, { timeSpent: 100 });
      await insertTestChapter(testDb, novelId1, { timeSpent: 200 });

      const novelId2 = await insertTestNovel(testDb, {
        name: 'Novel B',
        inLibrary: true,
      });
      await insertTestChapter(testDb, novelId2, { timeSpent: 500 });

      const result = await getTopNovelsByTimeSpentFromDb();

      expect(result.topNovelsByTimeSpent).toHaveLength(2);
      expect(result.topNovelsByTimeSpent![0]).toMatchObject({
        id: novelId2,
        name: 'Novel B',
        timeSpent: 500,
      });
      expect(result.topNovelsByTimeSpent![1]).toMatchObject({
        id: novelId1,
        name: 'Novel A',
        timeSpent: 300,
      });
    });

    it('should ignore novels that are not in the library', async () => {
      const testDb = getTestDb();

      const libraryNovelId = await insertTestNovel(testDb, { inLibrary: true });
      const nonLibraryNovelId = await insertTestNovel(testDb, {
        inLibrary: false,
      });

      await insertTestChapter(testDb, libraryNovelId, { timeSpent: 150 });
      await insertTestChapter(testDb, nonLibraryNovelId, { timeSpent: 999 });

      const result = await getTopNovelsByTimeSpentFromDb();

      expect(result.topNovelsByTimeSpent).toHaveLength(1);
      expect(result.topNovelsByTimeSpent![0].id).toBe(libraryNovelId);
    });

    it('should exclude novels with 0 or null time spent', async () => {
      const testDb = getTestDb();

      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });

      await insertTestChapter(testDb, novelId1, { timeSpent: 0 });
      await insertTestChapter(testDb, novelId2, { timeSpent: null });

      const result = await getTopNovelsByTimeSpentFromDb();

      expect(result.topNovelsByTimeSpent).toEqual([]);
    });

    it('should respect the limit of 10 items', async () => {
      const testDb = getTestDb();

      for (let i = 1; i <= 12; i++) {
        const novelId = await insertTestNovel(testDb, {
          name: `Novel ${i}`,
          inLibrary: true,
        });
        await insertTestChapter(testDb, novelId, { timeSpent: i * 10 });
      }

      const result = await getTopNovelsByTimeSpentFromDb();

      expect(result.topNovelsByTimeSpent).toHaveLength(10);
      expect(result.topNovelsByTimeSpent![0].name).toBe('Novel 12');
    });
  });

  describe('getTopCategoriesByTimeSpentFromDb', () => {
    it('should return categories ordered by accumulated time spent', async () => {
      const testDb = getTestDb();

      // Create categories
      const fantasyCat = await insertTestCategory(testDb, { name: 'Fantasy' });
      const scifiCat = await insertTestCategory(testDb, { name: 'Sci-Fi' });

      // Create novels
      const novel1 = await insertTestNovel(testDb, { inLibrary: true });
      const novel2 = await insertTestNovel(testDb, { inLibrary: true });

      await insertTestNovelCategory(testDb, novel1, fantasyCat);
      await insertTestNovelCategory(testDb, novel2, scifiCat);

      await insertTestChapter(testDb, novel1, { timeSpent: 100 });
      await insertTestChapter(testDb, novel2, { timeSpent: 300 });

      const result = await getTopCategoriesByTimeSpentFromDb();

      expect(result.topCategoriesByTimeSpent).toHaveLength(2);
      expect(result.topCategoriesByTimeSpent![0]).toMatchObject({
        id: scifiCat,
        name: 'Sci-Fi',
        timeSpent: 300,
      });
      expect(result.topCategoriesByTimeSpent![1]).toMatchObject({
        id: fantasyCat,
        name: 'Fantasy',
        timeSpent: 100,
      });
    });

    it('should sum timeSpent across multiple novels in the same category', async () => {
      const testDb = getTestDb();

      const catId = await insertTestCategory(testDb, { name: 'Action' });

      const novel1 = await insertTestNovel(testDb, { inLibrary: true });
      const novel2 = await insertTestNovel(testDb, { inLibrary: true });

      await insertTestNovelCategory(testDb, novel1, catId);
      await insertTestNovelCategory(testDb, novel2, catId);

      await insertTestChapter(testDb, novel1, { timeSpent: 200 });
      await insertTestChapter(testDb, novel2, { timeSpent: 150 });

      const result = await getTopCategoriesByTimeSpentFromDb();

      expect(result.topCategoriesByTimeSpent).toHaveLength(1);
      expect(result.topCategoriesByTimeSpent![0].timeSpent).toBe(350);
    });

    it('should return an empty array when no category chapters have spent time', async () => {
      const result = await getTopCategoriesByTimeSpentFromDb();

      expect(result.topCategoriesByTimeSpent).toEqual([]);
    });
  });
});
