/**
 * Tests for NovelQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import {
  insertTestChapter,
  insertTestNovel,
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
import type { BackupNovel } from '@database/types';

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
  _restoreNovelsAndChapters,
} from '../NovelQueries';

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

    it('should assign the categories selected while adding', async () => {
      const testDb = getTestDb();
      const firstCategoryId = await insertTestCategory(testDb, {
        name: 'First selected category',
      });
      const secondCategoryId = await insertTestCategory(testDb, {
        name: 'Second selected category',
      });
      const novelId = await insertTestNovel(testDb, {
        inLibrary: false,
        path: '/test/selected-categories',
        pluginId: 'test-plugin',
      });

      await switchNovelToLibraryQuery(
        '/test/selected-categories',
        'test-plugin',
        [firstCategoryId, secondCategoryId],
      );

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(associations.map(association => association.categoryId)).toEqual([
        firstCategoryId,
        secondCategoryId,
      ]);
    });

    it('should use the built-in default when no categories are selected', async () => {
      const testDb = getTestDb();
      const previousDefaultCategoryId = await insertTestCategory(testDb, {
        name: 'Previous default category',
      });
      const novelId = await insertTestNovel(testDb, {
        inLibrary: false,
        path: '/test/no-selected-categories',
        pluginId: 'test-plugin',
      });
      mockGetLibraryDefaultCategoryId.mockReturnValue(
        previousDefaultCategoryId,
      );

      await switchNovelToLibraryQuery(
        '/test/no-selected-categories',
        'test-plugin',
        [],
      );

      const associations = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(associations.map(association => association.categoryId)).toEqual([
        BUILT_IN_CATEGORY_IDS.default,
      ]);
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

  describe('_restoreNovelsAndChapters', () => {
    const backupChapter = (
      index: number,
      data: Partial<BackupNovel['chapters'][number]> = {},
    ): BackupNovel['chapters'][number] => ({
      id: 1000 + index,
      novelId: 1,
      path: `/restored/chapter-${index}`,
      name: `Chapter ${index}`,
      releaseTime: null,
      readTime: null,
      bookmark: false,
      unread: true,
      isDownloaded: false,
      updatedTime: null,
      chapterNumber: index,
      page: '1',
      progress: null,
      position: index,
      scanlator: null,
      timeSpent: 0,
      ...data,
    });

    const backupNovel = (
      data: Partial<BackupNovel> = {},
      chapterCount = 1,
    ): BackupNovel => ({
      id: 1,
      path: '/restored/novel',
      pluginId: 'restored-plugin',
      name: 'Restored Novel',
      cover: null,
      summary: null,
      author: null,
      artist: null,
      status: 'Ongoing',
      genres: null,
      inLibrary: true,
      isLocal: false,
      totalPages: 0,
      chapters: Array.from({ length: chapterCount }, (_, i) =>
        backupChapter(i + 1),
      ),
      ...data,
    });

    const rowsWithoutIds = <T extends Record<string, unknown>>(rows: T[]) =>
      rows.map(({ id: _id, novelId: _novelId, ...row }) => row);

    const restoreOne = async (novel: BackupNovel) => {
      const [result] = await _restoreNovelsAndChapters([novel]);
      if (!result.mapping) throw result.error;
      return result.mapping;
    };

    it('does not replace an unrelated novel when backup IDs collide', async () => {
      const testDb = getTestDb();
      await insertTestNovel(testDb, {
        path: '/existing/novel',
        pluginId: 'existing-plugin',
        name: 'Existing Novel',
        inLibrary: true,
      });

      const mapping = await restoreOne(
        backupNovel({
          chapters: [backupChapter(0, { id: 10, isDownloaded: true })],
        }),
      );

      expect(mapping.restoredNovelId).not.toBe(1);
      expect(
        (await getNovelByPath('/existing/novel', 'existing-plugin'))?.name,
      ).toBe('Existing Novel');
      expect(
        (await getNovelByPath('/restored/novel', 'restored-plugin'))?.id,
      ).toBe(mapping.restoredNovelId);
      const restoredChapters = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, mapping.restoredNovelId))
        .all();
      expect(mapping.chapters).toEqual([
        {
          backupChapterId: 10,
          restoredChapterId: restoredChapters[0].id,
        },
      ]);
    });

    it('stores the same rows as inserting the backup through Drizzle', async () => {
      const testDb = getTestDb();
      // Older backups can omit newer columns; values also arrive loosely typed.
      const {
        scanlator: _s,
        timeSpent: _t,
        ...legacyChapter
      } = backupChapter(3, {
        unread: false,
        readTime: '2024-02-01T10:00:00.000Z',
        bookmark: true,
        progress: 40,
      });
      const chapters = [
        backupChapter(1, {
          isDownloaded: true,
          updatedTime: '2024-03-05 10:00:00',
        }),
        backupChapter(2, {
          updatedTime: 'not a date',
          page: 2 as unknown as string,
        }),
        legacyChapter as BackupNovel['chapters'][number],
        backupChapter(4, {
          unread: 'yes' as unknown as boolean,
          updatedTime: '2024-03-01 10:00:00',
        }),
      ];
      const {
        status: _status,
        totalPages: _pages,
        ...novelWithoutDefaults
      } = backupNovel({
        cover: 'https://example.com/cover.png',
        lastReadAt: '2024-02-01T10:00:00.000Z',
        lastUpdatedAt: '2024-03-02 10:00:00',
      } as Partial<BackupNovel>);

      const mapping = await restoreOne({
        ...(novelWithoutDefaults as BackupNovel),
        chapters,
      });

      const { chapters: _c, id: _id, ...novel } = novelWithoutDefaults;
      const reference = await testDb.drizzleDb
        .insert(novelSchema)
        .values({
          ...novel,
          pluginId: 'reference-plugin',
          totalChapters: 0,
          chaptersDownloaded: 0,
          chaptersUnread: 0,
        })
        .returning({ id: novelSchema.id })
        .get();
      await testDb.drizzleDb
        .insert(chapterSchema)
        .values(
          chapters.map(({ id: _chapterId, ...chapter }) => ({
            ...chapter,
            novelId: reference.id,
          })),
        )
        .run();

      const selectChapters = (novelId: number) =>
        testDb.drizzleDb
          .select()
          .from(chapterSchema)
          .where(eq(chapterSchema.novelId, novelId))
          .orderBy(chapterSchema.id)
          .all();
      expect(
        rowsWithoutIds(await selectChapters(mapping.restoredNovelId)),
      ).toEqual(rowsWithoutIds(await selectChapters(reference.id)));

      const restoredNovel = await getNovelById(mapping.restoredNovelId);
      const referenceNovel = await getNovelById(reference.id);
      expect({ ...restoredNovel, id: 0, pluginId: '' }).toEqual({
        ...referenceNovel,
        id: 0,
        pluginId: '',
      });
      expect(restoredNovel).toMatchObject({
        status: 'Unknown',
        totalChapters: 4,
        chaptersDownloaded: 1,
        chaptersUnread: 3,
        lastUpdatedAt: '2024-03-05 10:00:00',
      });
    });

    it('maps every chapter across insert batch boundaries', async () => {
      const testDb = getTestDb();
      const novel = backupNovel({}, 250);

      const mapping = await restoreOne(novel);

      const restoredChapters = await testDb.drizzleDb
        .select({ id: chapterSchema.id, path: chapterSchema.path })
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, mapping.restoredNovelId))
        .all();
      const idsByPath = new Map(restoredChapters.map(c => [c.path, c.id]));
      expect(restoredChapters).toHaveLength(250);
      expect(mapping.chapters).toEqual(
        novel.chapters.map(chapter => ({
          backupChapterId: chapter.id,
          restoredChapterId: idsByPath.get(chapter.path),
        })),
      );
      expect((await getNovelById(mapping.restoredNovelId))?.totalChapters).toBe(
        250,
      );
    });

    it('replaces the chapters of an existing novel like the delete trigger would', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, {
        path: '/restored/novel',
        pluginId: 'restored-plugin',
        name: 'Old Name',
        author: 'Kept Author',
        inLibrary: true,
      });
      for (let i = 0; i < 3; i++) {
        await insertTestChapter(testDb, novelId, {
          path: `/old/chapter-${i}`,
          readTime: '2024-01-01T00:00:00.000Z',
          updatedTime: '2024-01-02 00:00:00',
        });
      }
      const { author: _author, ...novel } = backupNovel(
        {
          lastReadAt: '2024-02-01T10:00:00.000Z',
          lastUpdatedAt: '2024-03-02 10:00:00',
        } as Partial<BackupNovel>,
        2,
      );

      const mapping = await restoreOne(novel as BackupNovel);

      expect(mapping.restoredNovelId).toBe(novelId);
      const chapters = await testDb.drizzleDb
        .select({ path: chapterSchema.path })
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, novelId))
        .all();
      expect(chapters.map(c => c.path)).toEqual([
        '/restored/chapter-1',
        '/restored/chapter-2',
      ]);
      expect(await getNovelById(novelId)).toMatchObject({
        name: 'Restored Novel',
        author: 'Kept Author',
        totalChapters: 2,
        chaptersUnread: 2,
        lastReadAt: null,
        lastUpdatedAt: null,
      });

      // The suspended delete trigger is back in place after the restore.
      await testDb.drizzleDb
        .delete(chapterSchema)
        .where(eq(chapterSchema.path, '/restored/chapter-1'))
        .run();
      expect((await getNovelById(novelId))?.totalChapters).toBe(1);
    });

    it('rolls back only the novels that fail', async () => {
      const testDb = getTestDb();
      const broken = backupNovel(
        { id: 2, path: '/broken/novel', name: 'Broken' },
        2,
      );
      broken.chapters[1].path = broken.chapters[0].path;

      const results = await _restoreNovelsAndChapters([
        backupNovel({ id: 1 }),
        broken,
        backupNovel({ id: 3, path: '/third/novel', name: 'Third' }),
      ]);

      expect(results[0].mapping?.backupNovelId).toBe(1);
      expect(results[1].error).toBeDefined();
      expect(results[2].mapping?.backupNovelId).toBe(3);
      expect(await getNovelByPath('/broken/novel', 'restored-plugin')).toBe(
        undefined,
      );
      const novels = await testDb.drizzleDb.select().from(novelSchema).all();
      expect(novels.map(n => n.name).sort()).toEqual([
        'Restored Novel',
        'Third',
      ]);
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
