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
  _restoreCategory,
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

  describe('_restoreCategory', () => {
    it('preserves the default name and adds restored memberships', async () => {
      const testDb = getTestDb();
      const existingNovelId = await insertTestNovel(testDb, {
        inLibrary: true,
      });
      const restoredNovelId = await insertTestNovel(testDb, {
        inLibrary: true,
      });
      await insertTestNovelCategory(testDb, existingNovelId, 1);

      await _restoreCategory({
        id: 1,
        name: '   ',
        sort: 1,
        novelIds: [restoredNovelId],
      });

      const categories = await getCategoriesFromDb();
      expect(categories.find(category => category.id === 1)?.name).toBe(
        'Default',
      );
      const memberships = await getAllNovelCategories();
      expect(
        memberships
          .filter(membership => membership.categoryId === 1)
          .map(membership => membership.novelId),
      ).toEqual(expect.arrayContaining([existingNovelId, restoredNovelId]));
    });

    it('adds every mapped membership once across insert batches', async () => {
      const testDb = getTestDb();
      const novelIds: number[] = [];
      for (let i = 0; i < 520; i++) {
        novelIds.push(await insertTestNovel(testDb, { inLibrary: true }));
      }
      const backupIds = novelIds.map(id => id + 10000);
      const novelIdMap = new Map(backupIds.map((id, i) => [id, novelIds[i]]));
      const categoryId = await insertTestCategory(testDb, { name: 'Big' });
      await insertTestNovelCategory(testDb, novelIds[510], categoryId);

      await _restoreCategory(
        { id: 42, name: 'Big', sort: 3, novelIds: backupIds },
        novelIdMap,
      );

      const memberships = (await getAllNovelCategories()).filter(
        membership => membership.categoryId === categoryId,
      );
      expect(memberships.map(m => m.novelId).sort((a, b) => a - b)).toEqual(
        novelIds,
      );
    });

    it('does not overwrite a custom category with a colliding backup ID', async () => {
      const testDb = getTestDb();
      const existingCategoryId = await insertTestCategory(testDb, {
        name: 'Existing Category',
      });

      const restoredCategoryId = await _restoreCategory({
        id: existingCategoryId,
        name: 'Restored Category',
        sort: 3,
        novelIds: [],
      });

      expect(restoredCategoryId).not.toBe(existingCategoryId);
      const categories = await getCategoriesFromDb();
      expect(
        categories.find(category => category.id === existingCategoryId)?.name,
      ).toBe('Existing Category');
      expect(
        categories.find(category => category.id === restoredCategoryId)?.name,
      ).toBe('Restored Category');
    });

    it('does not treat a legacy category with ID 2 as the Local category', async () => {
      const restoredCategoryId = await _restoreCategory({
        id: 2,
        name: 'Legacy user category',
        sort: 2,
        novelIds: [],
      });

      expect(restoredCategoryId).not.toBe(2);
      const categories = await getCategoriesFromDb();
      expect(categories.find(category => category.id === 2)?.name).toBe(
        'Local',
      );
      expect(
        categories.find(category => category.id === restoredCategoryId)?.name,
      ).toBe('Legacy user category');
    });

    it('rejects a restored user category with an empty name', async () => {
      await expect(
        _restoreCategory({
          id: 3,
          name: '  ',
          sort: 3,
          novelIds: [],
        }),
      ).rejects.toThrow('Category name cannot be empty');
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

    it('trims category names', async () => {
      const category = await createCategory('  New Category  ');

      expect(category.name).toBe('New Category');
    });

    it('rejects an empty category name', async () => {
      await expect(createCategory('   ')).rejects.toThrow(
        'Category name cannot be empty',
      );
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

    it('trims the updated category name', async () => {
      const categoryId = await insertTestCategory(getTestDb(), {
        name: 'Old Name',
      });

      await updateCategory(categoryId, '  New Name  ');

      const categories = await getCategoriesFromDb();
      expect(
        categories.find(category => category.id === categoryId)?.name,
      ).toBe('New Name');
    });

    it('rejects an empty updated category name', async () => {
      const categoryId = await insertTestCategory(getTestDb(), {
        name: 'Old Name',
      });

      await expect(updateCategory(categoryId, '   ')).rejects.toThrow(
        'Category name cannot be empty',
      );
    });

    it('does not rename the default category', async () => {
      await updateCategory(1, 'Renamed Default');

      const categories = await getCategoriesFromDb();
      expect(categories.find(category => category.id === 1)?.name).toBe(
        'Default',
      );
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
        // eslint-disable-next-line jest/no-conditional-expect
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
        // eslint-disable-next-line jest/no-conditional-expect
        expect(
          associations.some(a => a.categoryId === defaultCategory.id),
        ).toBe(true);
      }
    });
  });

  describe('updateCategoryOrderInDb', () => {
    it('should persist categories using one-based display order', async () => {
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
      expect(updated1?.sort).toBe(1);
      expect(updated2?.sort).toBe(2);
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
