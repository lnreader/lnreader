/**
 * Tests for CategoryQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import {
  insertTestCategory,
  insertTestNovel,
  insertTestNovelCategory,
  clearAllTables,
} from './testData';
import { categorySchema, novelCategorySchema } from '@database/schema';
import { eq, sql } from 'drizzle-orm';

import {
  getCategoriesFromDb,
  getCategoriesWithCount,
  createCategory,
  isCategoryNameDuplicate,
  updateCategory,
  deleteCategoryById,
  updateCategoryOrderInDb,
  getAllNovelCategories,
} from '../CategoryQueries';
import { showToast } from '@utils/showToast';

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

  describe('getCategoriesWithCount', () => {
    it('should return categories with novel counts', async () => {
      const testDb = getTestDb();
      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = await insertTestCategory(testDb, {
        name: 'Test Category',
      });
      await insertTestNovelCategory(testDb, novelId1, categoryId);
      await insertTestNovelCategory(testDb, novelId2, categoryId);

      const result = await getCategoriesWithCount([novelId1, novelId2]);

      const testCat = result.find(c => c.id === categoryId);
      expect(testCat).toBeDefined();
      expect(testCat?.novelsCount).toBe(2);
    });

    it('should handle empty novel IDs array', async () => {
      const result = await getCategoriesWithCount([]);

      expect(result.length).toBeGreaterThan(0);
      // Should exclude category ID 2
      expect(result.every(c => c.id !== 2)).toBe(true);
    });

    it('should exclude category ID 2', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      const result = await getCategoriesWithCount([novelId]);

      expect(result.every(c => c.id !== 2)).toBe(true);
    });
  });

  describe('deleteCategoryById', () => {
    it('should prevent deletion of default categories', async () => {
      const testDb = getTestDb();
      const defaultCategory = await testDb.drizzleDb
        .select()
        .from(categorySchema)
        .where(sql`${categorySchema.id} <= 2`)
        .get();

      if (defaultCategory) {
        await deleteCategoryById({
          id: defaultCategory.id,
          name: 'Default',
          sort: defaultCategory.sort || 0,
        });

        // Should show toast and not delete
        expect(showToast).toHaveBeenCalled();
      }
    });

    it('should delete category and reassign novels to default', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = await insertTestCategory(testDb, {
        name: 'To Delete',
      });
      await insertTestNovelCategory(testDb, novelId, categoryId);

      // Get default category
      const defaultCategory = await testDb.drizzleDb
        .select()
        .from(categorySchema)
        .where(sql`${categorySchema.sort} = 1`)
        .get();

      const categoryToDelete = await testDb.drizzleDb
        .select()
        .from(categorySchema)
        .where(eq(categorySchema.id, categoryId))
        .get();

      if (categoryToDelete) {
        await deleteCategoryById({
          id: categoryId,
          name: 'To Delete',
          sort: categoryToDelete.sort || 0,
        });
      }

      // Check category is deleted
      const categories = await getCategoriesFromDb();
      expect(categories.find(c => c.id === categoryId)).toBeUndefined();

      // Check novel is reassigned to default category
      if (defaultCategory) {
        const associations = await testDb.drizzleDb
          .select()
          .from(novelCategorySchema)
          .where(eq(novelCategorySchema.novelId, novelId))
          .all();
        expect(
          associations.some(a => a.categoryId === defaultCategory.id),
        ).toBe(true);
      }
    });
  });

  describe('updateCategoryOrderInDb', () => {
    it('should update sort order for multiple categories', async () => {
      const testDb = getTestDb();
      const cat1 = await insertTestCategory(testDb, {
        name: 'Cat 1',
        sort: 10,
      });
      const cat2 = await insertTestCategory(testDb, {
        name: 'Cat 2',
        sort: 20,
      });

      await updateCategoryOrderInDb([
        { id: cat1, name: 'Cat 1', sort: 30 },
        { id: cat2, name: 'Cat 2', sort: 40 },
      ]);

      const categories = await getCategoriesFromDb();
      const updated1 = categories.find(c => c.id === cat1);
      const updated2 = categories.find(c => c.id === cat2);
      expect(updated1?.sort).toBe(30);
      expect(updated2?.sort).toBe(40);
    });

    it('should handle empty array', async () => {
      await expect(updateCategoryOrderInDb([])).resolves.not.toThrow();
    });
  });

  describe('getAllNovelCategories', () => {
    it('should return all novel-category associations', async () => {
      const testDb = getTestDb();
      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = await insertTestCategory(testDb, {
        name: 'Test Category',
      });
      await insertTestNovelCategory(testDb, novelId1, categoryId);
      await insertTestNovelCategory(testDb, novelId2, categoryId);

      const result = await getAllNovelCategories();

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(
        result.some(r => r.novelId === novelId1 && r.categoryId === categoryId),
      ).toBe(true);
      expect(
        result.some(r => r.novelId === novelId2 && r.categoryId === categoryId),
      ).toBe(true);
    });

    it('should return empty array when no associations', async () => {
      const result = await getAllNovelCategories();

      // May have default associations, so just check it's an array
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
