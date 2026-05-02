/**
 * Tests for NovelQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import {
  insertTestNovel,
  insertTestChapter,
  insertTestNovelCategory,
  insertTestCategory,
  clearAllTables,
} from './testData';
import {
  categorySchema,
  chapterSchema,
  novelCategorySchema,
  novelSchema,
} from '@database/schema';
import { eq } from 'drizzle-orm';
import { BUILT_IN_CATEGORY_IDS } from '@database/constants';

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
  _restoreNovelAndChapters,
} from '../NovelQueries';
import type { BackupNovel } from '@database/types';

const mockGetLibraryDefaultCategoryId = jest.fn<number | undefined, []>();

jest.mock('@hooks/persisted/useSettings', () => ({
  getLibraryDefaultCategoryId: () => mockGetLibraryDefaultCategoryId(),
}));

describe('NovelQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
    mockGetLibraryDefaultCategoryId.mockReturnValue(undefined);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('_restoreNovelAndChapters', () => {
    it('merges a matching novel and preserves combined reading state', async () => {
      const testDb = getTestDb();
      const existingNovelId = await insertTestNovel(testDb, {
        path: '/shared-novel',
        pluginId: 'shared-plugin',
        name: 'Local name',
        cover: 'local-cover.jpg',
        summary: null,
        inLibrary: true,
        isLocal: false,
        totalPages: 10,
      });
      const existingChapterId = await insertTestChapter(
        testDb,
        existingNovelId,
        {
          path: '/chapter-1',
          name: 'Local chapter name',
          bookmark: true,
          unread: true,
          readTime: '2026-01-01T00:00:00.000Z',
          isDownloaded: false,
          updatedTime: '2026-01-01T00:00:00.000Z',
          page: '2',
          progress: 30,
          position: 4,
          scanlator: 'Local group',
          timeSpent: 40,
        },
      );
      const novelIdMap = new Map<number, number>();
      const backupNovel: BackupNovel = {
        id: 999,
        path: '/shared-novel',
        pluginId: 'shared-plugin',
        name: 'Backup name',
        cover: 'backup-cover.jpg',
        summary: 'Backup summary',
        inLibrary: false,
        isLocal: true,
        totalPages: 20,
        chapters: [
          {
            id: 501,
            novelId: 999,
            path: '/chapter-1',
            name: 'Backup chapter name',
            releaseTime: null,
            bookmark: false,
            unread: false,
            readTime: '2026-02-01T00:00:00.000Z',
            isDownloaded: true,
            updatedTime: '2026-02-01T00:00:00.000Z',
            chapterNumber: 1,
            page: '3',
            progress: 80,
            position: 8,
            scanlator: 'Backup group',
            timeSpent: 90,
          },
          {
            id: 502,
            novelId: 999,
            path: '/chapter-2',
            name: 'New chapter',
            releaseTime: null,
            bookmark: false,
            unread: true,
            readTime: null,
            isDownloaded: false,
            updatedTime: null,
            chapterNumber: 2,
            page: '1',
            progress: null,
            position: 0,
            scanlator: null,
            timeSpent: 0,
          },
        ],
      };

      await _restoreNovelAndChapters(backupNovel, {
        mode: 'merge',
        novelIdMap,
      });

      const restoredNovel = await testDb.drizzleDb
        .select()
        .from(novelSchema)
        .where(eq(novelSchema.id, existingNovelId))
        .get();
      const restoredChapters = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, existingNovelId))
        .all();
      const mergedChapter = restoredChapters.find(
        chapter => chapter.id === existingChapterId,
      );

      expect(novelIdMap.get(999)).toBe(existingNovelId);
      expect(restoredNovel).toMatchObject({
        name: 'Backup name',
        cover: 'local-cover.jpg',
        summary: 'Backup summary',
        inLibrary: true,
        isLocal: true,
        totalPages: 20,
      });
      expect(restoredChapters).toHaveLength(2);
      expect(mergedChapter).toMatchObject({
        name: 'Local chapter name',
        bookmark: true,
        unread: false,
        readTime: '2026-02-01T00:00:00.000Z',
        isDownloaded: true,
        updatedTime: '2026-02-01T00:00:00.000Z',
        page: '2',
        progress: 80,
        position: 8,
        scanlator: 'Local group',
        timeSpent: 90,
      });
      expect(restoredChapters).toContainEqual(
        expect.objectContaining({
          novelId: existingNovelId,
          path: '/chapter-2',
        }),
      );
    });
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

      expect(Boolean(result?.inLibrary)).toBe(true);
      const novel = getNovelById(novelId);
      expect(Boolean(novel?.inLibrary)).toBe(true);
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

      expect(Boolean(result?.inLibrary)).toBe(false);
      const novel = getNovelById(novelId);
      expect(Boolean(novel?.inLibrary)).toBe(false);
    });

    it('should fall back to the built-in default category by ID', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: false,
        path: '/test/novel',
        pluginId: 'test-plugin',
      });

      await testDb.drizzleDb
        .update(categorySchema)
        .set({ sort: 0 })
        .where(eq(categorySchema.id, BUILT_IN_CATEGORY_IDS.default))
        .run();
      await testDb.drizzleDb
        .update(categorySchema)
        .set({ sort: 1 })
        .where(eq(categorySchema.id, BUILT_IN_CATEGORY_IDS.local))
        .run();

      await switchNovelToLibraryQuery('/test/novel', 'test-plugin');

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(associations.length).toBeGreaterThan(0);
      expect(
        associations.some(
          association =>
            association.categoryId === BUILT_IN_CATEGORY_IDS.default,
        ),
      ).toBe(true);
      expect(
        associations.some(
          association => association.categoryId === BUILT_IN_CATEGORY_IDS.local,
        ),
      ).toBe(false);
    });

    it('should assign the user-selected default category', async () => {
      const testDb = getTestDb();
      const categoryId = await insertTestCategory(testDb, {
        name: 'Preferred Category',
      });
      const novelId = await insertTestNovel(testDb, {
        inLibrary: false,
        path: '/test/preferred-category',
        pluginId: 'test-plugin',
      });
      mockGetLibraryDefaultCategoryId.mockReturnValue(categoryId);

      await switchNovelToLibraryQuery(
        '/test/preferred-category',
        'test-plugin',
      );

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(
        associations.some(association => association.categoryId === categoryId),
      ).toBe(true);
    });

    it('should fall back when the selected category no longer exists', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        inLibrary: false,
        path: '/test/missing-preferred-category',
        pluginId: 'test-plugin',
      });
      mockGetLibraryDefaultCategoryId.mockReturnValue(999);

      await switchNovelToLibraryQuery(
        '/test/missing-preferred-category',
        'test-plugin',
      );

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(
        associations.some(
          association =>
            association.categoryId === BUILT_IN_CATEGORY_IDS.default,
        ),
      ).toBe(true);
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
      expect(Boolean(novel1?.inLibrary)).toBe(false);
      expect(Boolean(novel2?.inLibrary)).toBe(false);
    });

    it('should handle empty array', async () => {
      await expect(removeNovelsFromLibrary([])).resolves.not.toThrow();
    });

    it('should clean up categories when removing from library', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = await insertTestCategory(testDb, {
        name: 'Test Category',
      });
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
      const categoryId = await insertTestCategory(testDb, {
        name: 'Test Category',
      });

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
    it('should add a novel to the library with only the selected categories', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: false });
      const categoryId = await insertTestCategory(testDb, {
        name: 'Selected Category',
      });

      await updateNovelCategories([novelId], [categoryId]);

      const novel = await testDb.drizzleDb
        .select()
        .from(novelSchema)
        .where(eq(novelSchema.id, novelId))
        .get();
      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(Boolean(novel?.inLibrary)).toBe(true);
      expect(associations.map(item => item.categoryId)).toEqual([categoryId]);
    });

    it('should update categories for multiple novels', async () => {
      const testDb = getTestDb();
      const novelId1 = await insertTestNovel(testDb, { inLibrary: true });
      const novelId2 = await insertTestNovel(testDb, { inLibrary: true });
      const categoryId = await insertTestCategory(testDb, {
        name: 'Test Category',
      });

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
