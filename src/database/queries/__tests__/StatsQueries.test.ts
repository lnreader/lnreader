/**
 * Tests for StatsQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, insertTestChapter, clearAllTables, insertTestNovelCategory, insertTestCategory } from './testData';

import {
  getLibraryStatsFromDb,
  getChaptersTotalCountFromDb,
  getChaptersReadCountFromDb,
  getChaptersUnreadCountFromDb,
  getChaptersDownloadedCountFromDb,
  getNovelGenresFromDb,
  getNovelStatusFromDb,
  getTotalTimeSpentFromDb,
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

  describe('getLibraryStatsFromDb', () => {
    it('should return correct novel and source counts', async () => {
      const testDb = getTestDb();

      // Insert novels from different sources
      await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'source1',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'source1',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        pluginId: 'source2',
      });
      await insertTestNovel(testDb, {
        inLibrary: false, // Not in library
      });

      const result = await getLibraryStatsFromDb();

      expect(result.novelsCount).toBe(3);
      expect(result.sourcesCount).toBe(2);
    });

    it('should return zero counts when library is empty', async () => {
      const result = await getLibraryStatsFromDb();

      expect(result.novelsCount).toBe(0);
      expect(result.sourcesCount).toBe(0);
    });

    it('should only count novels in library', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { inLibrary: true });
      await insertTestNovel(testDb, { inLibrary: true });
      await insertTestNovel(testDb, { inLibrary: false });
      await insertTestNovel(testDb, { inLibrary: false });

      const result = await getLibraryStatsFromDb();

      expect(result.novelsCount).toBe(2);
    });
  });

  describe('getChaptersTotalCountFromDb', () => {
    it('should return correct total chapter count', async () => {
      const testDb = getTestDb();

      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestNovel(testDb, { inLibrary: false }); // Not in library

      await insertTestChapter(testDb, novelId1);
      await insertTestChapter(testDb, novelId1);
      await insertTestChapter(testDb, novelId2);
      await insertTestChapter(testDb, novelId2);
      await insertTestChapter(testDb, novelId2);

      const result = await getChaptersTotalCountFromDb();

      expect(result.chaptersCount).toBe(5);
    });

    it('should return zero when no chapters in library novels', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { inLibrary: true });

      const result = await getChaptersTotalCountFromDb();

      expect(result.chaptersCount).toBe(0);
    });

    it('should only count chapters from library novels', async () => {
      const testDb = getTestDb();

      const libraryNovelId = await insertTestNovel(testDb, { inLibrary: true });
      const nonLibraryNovelId = await insertTestNovel(testDb, {
        inLibrary: false,
      });

      await insertTestChapter(testDb, libraryNovelId);
      await insertTestChapter(testDb, libraryNovelId);
      await insertTestChapter(testDb, nonLibraryNovelId);

      const result = await getChaptersTotalCountFromDb();

      expect(result.chaptersCount).toBe(2);
    });
  });

  describe('getChaptersReadCountFromDb', () => {
    it('should return correct count of read chapters', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertTestChapter(testDb, novelId, { unread: false }); // Read
      await insertTestChapter(testDb, novelId, { unread: false }); // Read
      await insertTestChapter(testDb, novelId, { unread: true }); // Unread

      const result = await getChaptersReadCountFromDb();

      expect(result.chaptersRead).toBe(2);
    });

    it('should return zero when no chapters are read', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { unread: true });

      const result = await getChaptersReadCountFromDb();

      expect(result.chaptersRead).toBe(0);
    });

    it('should only count chapters from library novels', async () => {
      const testDb = getTestDb();

      const libraryNovelId = await insertTestNovel(testDb, { inLibrary: true });
      const nonLibraryNovelId = await insertTestNovel(testDb, {
        inLibrary: false,
      });

      await insertTestChapter(testDb, libraryNovelId, { unread: false });
      await insertTestChapter(testDb, nonLibraryNovelId, { unread: false });

      const result = await getChaptersReadCountFromDb();

      expect(result.chaptersRead).toBe(1);
    });
  });

  describe('getChaptersUnreadCountFromDb', () => {
    it('should return correct count of unread chapters', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertTestChapter(testDb, novelId, { unread: true }); // Unread
      await insertTestChapter(testDb, novelId, { unread: true }); // Unread
      await insertTestChapter(testDb, novelId, { unread: false }); // Read

      const result = await getChaptersUnreadCountFromDb();

      expect(result.chaptersUnread).toBe(2);
    });

    it('should return zero when all chapters are read', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { unread: false });

      const result = await getChaptersUnreadCountFromDb();

      expect(result.chaptersUnread).toBe(0);
    });
  });

  describe('getChaptersDownloadedCountFromDb', () => {
    it('should return correct count of downloaded chapters', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertTestChapter(testDb, novelId, { isDownloaded: true });
      await insertTestChapter(testDb, novelId, { isDownloaded: true });
      await insertTestChapter(testDb, novelId, { isDownloaded: false });

      const result = await getChaptersDownloadedCountFromDb();

      expect(result.chaptersDownloaded).toBe(2);
    });

    it('should return zero when no chapters are downloaded', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { isDownloaded: false });

      const result = await getChaptersDownloadedCountFromDb();

      expect(result.chaptersDownloaded).toBe(0);
    });
  });

  describe('getNovelGenresFromDb', () => {
    it('should return correct genre distribution', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, {
        inLibrary: true,
        genres: 'Fantasy, Adventure',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        genres: 'Fantasy, Romance',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        genres: 'Sci-Fi',
      });
      await insertTestNovel(testDb, {
        inLibrary: false,
        genres: 'Horror', // Not in library
      });

      const result = await getNovelGenresFromDb();

      expect(result.genres).toEqual({
        Fantasy: 2,
        Adventure: 1,
        Romance: 1,
        'Sci-Fi': 1,
      });
    });

    it('should return empty genres when no novels in library', async () => {
      const result = await getNovelGenresFromDb();

      expect(result.genres).toEqual({});
    });

    it('should handle novels with null genres', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { inLibrary: true, genres: null });
      await insertTestNovel(testDb, { inLibrary: true, genres: 'Fantasy' });

      const result = await getNovelGenresFromDb();

      expect(result.genres).toEqual({ Fantasy: 1 });
    });

    it('should handle genres with extra whitespace', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, {
        inLibrary: true,
        genres: 'Fantasy,  Adventure,   Action',
      });

      const result = await getNovelGenresFromDb();

      expect(result.genres).toHaveProperty('Fantasy');
      expect(result.genres).toHaveProperty('Adventure');
      expect(result.genres).toHaveProperty('Action');
    });
  });

  describe('getNovelStatusFromDb', () => {
    it('should return correct status distribution', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { inLibrary: true, status: 'Ongoing' });
      await insertTestNovel(testDb, { inLibrary: true, status: 'Ongoing' });
      await insertTestNovel(testDb, { inLibrary: true, status: 'Completed' });
      await insertTestNovel(testDb, { inLibrary: true, status: 'Hiatus' });
      await insertTestNovel(testDb, {
        inLibrary: false,
        status: 'Dropped', // Not in library
      });

      const result = await getNovelStatusFromDb();

      expect(result.status).toEqual({
        Ongoing: 2,
        Completed: 1,
        Hiatus: 1,
      });
    });

    it('should return empty status when no novels in library', async () => {
      const result = await getNovelStatusFromDb();

      expect(result.status).toEqual({});
    });

    it('should handle novels with null status', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { inLibrary: true, status: null });
      await insertTestNovel(testDb, { inLibrary: true, status: 'Ongoing' });

      const result = await getNovelStatusFromDb();

      expect(result.status).toEqual({ Ongoing: 1 });
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
      expect(result.topNovelsByTimeSpent!![0]).toMatchObject({
        id: novelId2,
        name: 'Novel B',
        timeSpent: 500,
      });
      expect(result.topNovelsByTimeSpent!![1]).toMatchObject({
        id: novelId1,
        name: 'Novel A',
        timeSpent: 300,
      });
    });

    it('should ignore novels that are not in the library', async () => {
      const testDb = getTestDb();

      const libraryNovelId = await insertTestNovel(testDb, { inLibrary: true });
      const nonLibraryNovelId = await insertTestNovel(testDb, { inLibrary: false });

      await insertTestChapter(testDb, libraryNovelId, { timeSpent: 150 });
      await insertTestChapter(testDb, nonLibraryNovelId, { timeSpent: 999 });

      const result = await getTopNovelsByTimeSpentFromDb();

      expect(result.topNovelsByTimeSpent).toHaveLength(1);
      expect(result.topNovelsByTimeSpent!![0].id).toBe(libraryNovelId);
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
      expect(result.topNovelsByTimeSpent!![0].name).toBe('Novel 12');
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
      expect(result.topCategoriesByTimeSpent!![0]).toMatchObject({
        id: scifiCat,
        name: 'Sci-Fi',
        timeSpent: 300,
      });
      expect(result.topCategoriesByTimeSpent!![1]).toMatchObject({
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
      expect(result.topCategoriesByTimeSpent!![0].timeSpent).toBe(350);
    });

    it('should return an empty array when no category chapters have spent time', async () => {
      const result = await getTopCategoriesByTimeSpentFromDb();

      expect(result.topCategoriesByTimeSpent).toEqual([]);
    });
  });

  describe('getTotalTimeSpentFromDb', () => {
    it('should sum timeSpent across all chapters', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await insertTestChapter(testDb, novelId, { timeSpent: 120 });
      await insertTestChapter(testDb, novelId, { timeSpent: 180 });
      await insertTestChapter(testDb, novelId, { timeSpent: 50 });

      const result = await getTotalTimeSpentFromDb();

      expect(result.totalTimeSpent).toBe(350);
    });

    it('should return 0 when there are no chapters or total is null/zero', async () => {
      const result = await getTotalTimeSpentFromDb();

      expect(result.totalTimeSpent).toBe(0);
    });
  });
});
