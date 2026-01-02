/**
 * Tests for CategoryQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import {
  insertTestCategory,
  insertTestNovel,
  insertTestNovelCategory,
  clearAllTables,
} from './testData';

import {
  getCategoriesFromDb,
  createCategory,
  isCategoryNameDuplicate,
  updateCategory,
} from '../CategoryQueries';

describe('CategoryQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('getCategoriesFromDb', () => {
    it('should return all categories with novel IDs', async () => {
      const testDb = getTestDb();

      const categoryId = await insertTestCategory(testDb, {
        name: 'Test Category',
      });
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestNovelCategory(testDb, novelId, categoryId);

      const result = await getCategoriesFromDb();

      expect(result.length).toBeGreaterThanOrEqual(3); // Default + Local + Test Category
      const testCat = result.find(c => c.id === categoryId);
      expect(testCat).toBeDefined();
      expect(testCat?.novelIds).toBe(String(novelId));
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      const result = await createCategory('New Category');

      expect(result).toBeDefined();
      expect(result.name).toBe('New Category');
      expect(result.id).toBeGreaterThan(2); // Greater than default categories
    });

    it('should auto-assign sort order', async () => {
      const cat1 = await createCategory('Category 1');
      const cat2 = await createCategory('Category 2');

      expect(cat2.sort).toBeGreaterThan(cat1.sort!);
    });
  });

  describe('isCategoryNameDuplicate', () => {
    it('should return true when category name exists', async () => {
      const testDb = getTestDb();

      await insertTestCategory(testDb, { name: 'Existing Category' });

      const result = isCategoryNameDuplicate('Existing Category');

      expect(result).toBe(true);
    });

    it('should return false when category name does not exist', () => {
      const result = isCategoryNameDuplicate('Non-existent Category');

      expect(result).toBe(false);
    });
  });

  describe('updateCategory', () => {
    it('should update category name', async () => {
      const testDb = getTestDb();

      const categoryId = await insertTestCategory(testDb, { name: 'Old Name' });

      await updateCategory(categoryId, 'New Name');

      const categories = await getCategoriesFromDb();
      const updated = categories.find(c => c.id === categoryId);
      expect(updated?.name).toBe('New Name');
    });
  });
});
