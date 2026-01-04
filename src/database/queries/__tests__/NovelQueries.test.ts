/**
 * Tests for NovelQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import {
  insertTestNovel,
  insertTestNovelCategory,
  clearAllTables,
} from './testData';
import { categorySchema, novelCategorySchema } from '@database/schema';
import { eq, sql } from 'drizzle-orm';

import {
  getAllNovels,
  getNovelById,
  getNovelByPath,
  insertNovelAndChapters,
  switchNovelToLibraryQuery,
  removeNovelsFromLibrary,
  getCachedNovels,
  deleteCachedNovels,
  restoreLibrary,
  updateNovelInfo,
  pickCustomNovelCover,
  updateNovelCategoryById,
  updateNovelCategories,
} from '../NovelQueries';

describe('NovelQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('getAllNovels', () => {
    it('should return all novels', async () => {
      const testDb = getTestDb();

      await insertTestNovel(testDb, { name: 'Novel 1' });
      await insertTestNovel(testDb, { name: 'Novel 2' });

      const result = await getAllNovels();

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.map(n => n.name)).toContain('Novel 1');
      expect(result.map(n => n.name)).toContain('Novel 2');
    });
  });

  describe('getNovelById', () => {
    it('should return novel by ID', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { name: 'Test Novel' });

      const result = await getNovelById(novelId);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Novel');
    });

    it('should return undefined when novel not found', async () => {
      const result = await getNovelById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('getNovelByPath', () => {
    it('should return novel by path and pluginId', async () => {
      const testDb = getTestDb();

      const path = '/test/novel';
      const pluginId = 'test-plugin';
      await insertTestNovel(testDb, { path, pluginId, name: 'Test Novel' });

      const result = getNovelByPath(path, pluginId);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Novel');
    });

    it('should return undefined when novel not found', () => {
      const result = getNovelByPath('/nonexistent', 'test-plugin');

      expect(result).toBeUndefined();
    });
  });

  describe('insertNovelAndChapters', () => {
    it('should insert novel and chapters', async () => {
      const sourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Test Novel',
        chapters: [
          {
            path: '/chapter/1',
            name: 'Chapter 1',
            page: '1',
          },
        ],
      };

      const novelId = await insertNovelAndChapters('test-plugin', sourceNovel);

      expect(novelId).toBeDefined();
      const novel = await getNovelById(novelId!);
      expect(novel?.name).toBe('Test Novel');
    });

    it('should handle conflict (onConflictDoNothing)', async () => {
      const sourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Test Novel',
        chapters: [],
      };

      await insertNovelAndChapters('test-plugin', sourceNovel);
      const novelId2 = await insertNovelAndChapters('test-plugin', sourceNovel);

      // Second insert should return undefined due to conflict
      expect(novelId2).toBeUndefined();
    });
  });

  describe('switchNovelToLibraryQuery', () => {
    it('should add novel to library when novel exists', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: false,
        path: '/test/novel',
        pluginId: 'test-plugin',
      });

      const result = await switchNovelToLibraryQuery(
        '/test/novel',
        'test-plugin',
      );

      expect(result?.inLibrary).toBe(true);
      const novel = await getNovelById(novelId);
      expect(novel?.inLibrary).toBe(true);
    });

    it('should remove novel from library', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: true,
        path: '/test/novel',
        pluginId: 'test-plugin',
      });

      const result = await switchNovelToLibraryQuery(
        '/test/novel',
        'test-plugin',
      );

      expect(result?.inLibrary).toBe(false);
      const novel = await getNovelById(novelId);
      expect(novel?.inLibrary).toBe(false);
    });

    it('should assign default category when adding to library', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: false,
        path: '/test/novel',
        pluginId: 'test-plugin',
      });

      // Get default category (sort = 1)
      const defaultCategory = await testDb.drizzleDb
        .select()
        .from(categorySchema)
        .where(sql`${categorySchema.sort} = 1`)
        .get();

      await switchNovelToLibraryQuery('/test/novel', 'test-plugin');

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(associations.length).toBeGreaterThan(0);
      if (defaultCategory) {
        expect(
          associations.some(a => a.categoryId === defaultCategory.id),
        ).toBe(true);
      }
    });
  });

  describe('removeNovelsFromLibrary', () => {
    it('should remove multiple novels from library', async () => {
      const testDb = getTestDb();
      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });

      await removeNovelsFromLibrary([novelId1, novelId2]);

      const novel1 = await getNovelById(novelId1);
      const novel2 = await getNovelById(novelId2);
      expect(novel1?.inLibrary).toBe(false);
      expect(novel2?.inLibrary).toBe(false);
    });

    it('should handle empty array', async () => {
      await expect(removeNovelsFromLibrary([])).resolves.not.toThrow();
    });

    it('should clean up categories when removing from library', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = await testDb.drizzleDb
        .insert(categorySchema)
        .values({ name: 'Test Category' })
        .returning()
        .get().id;
      await insertTestNovelCategory(testDb, novelId, categoryId);

      await removeNovelsFromLibrary([novelId]);

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(associations).toHaveLength(0);
    });
  });

  describe('getCachedNovels', () => {
    it('should return only novels not in library', async () => {
      const testDb = getTestDb();
      await insertTestNovel(testDb, { inLibrary: false, name: 'Cached Novel' });
      await insertTestNovel(testDb, { inLibrary: true, name: 'Library Novel' });

      const result = await getCachedNovels();

      expect(result.every(n => n.inLibrary === false)).toBe(true);
      expect(result.some(n => n.name === 'Cached Novel')).toBe(true);
    });

    it('should return empty array when no cached novels', async () => {
      const testDb = getTestDb();
      await insertTestNovel(testDb, { inLibrary: true });

      const result = await getCachedNovels();

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteCachedNovels', () => {
    it('should delete all cached novels', async () => {
      await insertTestNovel(getTestDb(), { inLibrary: false });
      await insertTestNovel(getTestDb(), { inLibrary: false });
      await insertTestNovel(getTestDb(), { inLibrary: true });

      await deleteCachedNovels();

      const cached = await getCachedNovels();
      expect(cached).toHaveLength(0);
      const all = await getAllNovels();
      expect(all.length).toBe(1); // Only library novel remains
    });
  });

  describe('restoreLibrary', () => {
    it('should restore novel from backup', async () => {
      const novel = {
        id: 999,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Restored Novel',
        cover: null,
        summary: null,
        author: null,
        artist: null,
        status: 'Ongoing',
        genres: null,
        inLibrary: true,
        isLocal: false,
        totalPages: 1,
        chaptersDownloaded: 0,
        chaptersUnread: 0,
        totalChapters: 0,
        lastReadAt: null,
        lastUpdatedAt: null,
      };

      // Mock fetchNovel to return a valid SourceNovel
      const { fetchNovel } = require('@services/plugin/fetch');
      jest.mocked(fetchNovel).mockResolvedValueOnce({
        id: undefined,
        path: '/test/novel',
        name: 'Restored Novel',
        chapters: [],
      });

      await restoreLibrary(novel);

      const restored = await getNovelByPath('/test/novel', 'test-plugin');
      expect(restored?.name).toBe('Restored Novel');
    });
  });

  describe('updateNovelInfo', () => {
    it('should update novel information', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        name: 'Old Name',
        author: 'Old Author',
      });

      const updatedInfo = {
        id: novelId,
        name: 'New Name',
        author: 'New Author',
        cover: 'new-cover.png',
        path: '/test/novel',
        pluginId: 'test-plugin',
        summary: 'New summary',
        artist: 'New Artist',
        genres: 'Fantasy',
        status: 'Ongoing',
        isLocal: false,
        inLibrary: true,
        totalPages: 1,
        chaptersDownloaded: 0,
        chaptersUnread: 0,
        totalChapters: 0,
        lastReadAt: null,
        lastUpdatedAt: null,
      };

      await updateNovelInfo(updatedInfo);

      const novel = await getNovelById(novelId);
      expect(novel?.name).toBe('New Name');
      expect(novel?.author).toBe('New Author');
    });
  });

  describe('pickCustomNovelCover', () => {
    it('should handle canceled pick', async () => {
      const novelId = await insertTestNovel(getTestDb(), {
        name: 'Test Novel',
      });
      const novel = await getNovelById(novelId);

      // Mock DocumentPicker to return canceled
      const DocumentPicker = require('expo-document-picker');
      jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
        canceled: true,
        assets: null,
      });

      const result = await pickCustomNovelCover(novel!);

      // When canceled, should return undefined
      expect(result).toBeUndefined();
    });
  });

  describe('updateNovelCategoryById', () => {
    it('should add categories to a novel', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = await testDb.drizzleDb
        .insert(categorySchema)
        .values({ name: 'Test Category' })
        .returning()
        .get().id;

      await updateNovelCategoryById(novelId, [categoryId]);

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(associations.some(a => a.categoryId === categoryId)).toBe(true);
    });
  });

  describe('updateNovelCategories', () => {
    it('should update categories for multiple novels', async () => {
      const testDb = getTestDb();
      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = await testDb.drizzleDb
        .insert(categorySchema)
        .values({ name: 'Test Category' })
        .returning()
        .get().id;

      await updateNovelCategories([novelId1, novelId2], [categoryId]);

      const associations1 = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId1))
        .all();
      const associations2 = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId2))
        .all();

      expect(associations1.some(a => a.categoryId === categoryId)).toBe(true);
      expect(associations2.some(a => a.categoryId === categoryId)).toBe(true);
    });

    it('should handle empty novel IDs array', async () => {
      await expect(updateNovelCategories([], [1])).resolves.not.toThrow();
    });

    it('should assign default category when no categories provided', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });

      await updateNovelCategories([novelId], []);

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      // Should have at least one category (default)
      expect(associations.length).toBeGreaterThan(0);
    });
  });
});
