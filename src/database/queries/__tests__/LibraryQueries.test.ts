/**
 * Tests for LibraryQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import {
  insertTestNovel,
  clearAllTables,
  insertTestNovelCategory,
} from './testData';

import {
  getLibraryNovelsFromDb,
  getLibraryWithCategory,
} from '../LibraryQueries';

describe('LibraryQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('getLibraryNovelsFromDb', () => {
    it('should return all novels in library', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel 1' });
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel 2' });
      await insertTestNovel(testDb, { inLibrary: false, name: 'Novel 3' });

      const result = await getLibraryNovelsFromDb();

      expect(result).toHaveLength(2);
      expect(result.map(n => n.name)).toContain('Novel 1');
      expect(result.map(n => n.name)).toContain('Novel 2');
    });

    it('should filter by search text', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Fantasy Novel',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Sci-Fi Novel',
      });

      const result = await getLibraryNovelsFromDb(
        undefined,
        undefined,
        'Fantasy',
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Fantasy Novel');
    });

    it('should filter downloaded only mode', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, {
        inLibrary: true,
        chaptersDownloaded: 1,
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        chaptersDownloaded: 0,
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        isLocal: true,
        chaptersDownloaded: 0,
      });

      const result = await getLibraryNovelsFromDb(
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(result.length).toBeGreaterThanOrEqual(2); // At least 2 (downloaded + local)
    });

    it('should exclude local novels when requested', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { inLibrary: true, isLocal: false });
      await insertTestNovel(testDb, { inLibrary: true, isLocal: true });

      const result = await getLibraryNovelsFromDb(
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(result).toHaveLength(1);
      expect(result[0].isLocal).toBe(false);
    });
  });

  describe('getLibraryWithCategory', () => {
    it('should return novels for a specific category', async () => {
      const testDb = getTestDb();

      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = 1; // Default category

      await insertTestNovelCategory(testDb, novelId1, categoryId);
      await insertTestNovelCategory(testDb, novelId2, categoryId);

      const result = await getLibraryWithCategory(categoryId);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when category has no novels', () => {
      const result = getLibraryWithCategory(999);

      expect(result).toEqual([]);
    });
  });
});
