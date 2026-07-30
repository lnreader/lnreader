import './mockDb';
import {
  clearAllTables,
  insertTestNovel,
  insertTestChapter,
  insertTestNovelCategory,
  insertTestCategory,
} from './testData';
import {
  getLibraryNovelsFromDb,
  getLibraryNovelsForGlobalUpdate,
  getLibraryWithCategory,
} from '../LibraryQueries';
import { TestDb } from './testDb';
import { setupTestDatabase, teardownTestDatabase } from './setup';

describe('LibraryQueries', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = setupTestDatabase();
    clearAllTables(testDb);
  });
  afterAll(() => {
    teardownTestDatabase();
  });

  describe('getLibraryNovelsFromDb', () => {
    it('should return all library novels with default filters', async () => {
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel A' });
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel B' });
      await insertTestNovel(testDb, { inLibrary: false, name: 'Novel C' });

      const novels = await getLibraryNovelsFromDb();
      expect(novels).toHaveLength(2);
      expect(novels.map(n => n.name)).toEqual(['Novel A', 'Novel B']);
    });

    it('should sort novels by name ascending', async () => {
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel B' });
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel A' });

      const novels = await getLibraryNovelsFromDb('name ASC');
      expect(novels.map(n => n.name)).toEqual(['Novel A', 'Novel B']);
    });

    it('should sort novels by name descending', async () => {
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel B' });
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel A' });

      const novels = await getLibraryNovelsFromDb('name DESC');
      expect(novels.map(n => n.name)).toEqual(['Novel B', 'Novel A']);
    });

    it('should sort mixed timestamp formats by their actual date', async () => {
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'ISO timestamp',
        lastUpdatedAt: '2026-07-28T09:00:00.000Z',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'SQLite timestamp',
        lastUpdatedAt: '2026-07-28 10:00:00',
      });

      const novels = await getLibraryNovelsFromDb('lastUpdatedAt DESC');

      expect(novels.map(n => n.name)).toEqual([
        'SQLite timestamp',
        'ISO timestamp',
      ]);
    });

    it('should update lastUpdatedAt across mixed timestamp formats', async () => {
      const novelId = await insertTestNovel(testDb, {
        inLibrary: true,
        lastUpdatedAt: '2026-07-28T09:00:00.000Z',
      });

      await insertTestChapter(testDb, novelId, {
        updatedTime: '2026-07-28 10:00:00',
      });

      const novel = await getLibraryNovelsFromDb();
      expect(novel[0].lastUpdatedAt).toBe('2026-07-28 10:00:00');
    });

    it('should filter novels by raw SQL filter', async () => {
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel A',
        author: 'Author One',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel B',
        author: 'Author Two',
      });

      const novels = await getLibraryNovelsFromDb(
        undefined,
        "author = 'Author One'",
      );
      expect(novels).toHaveLength(1);
      expect(novels[0].name).toBe('Novel A');
    });

    it('should filter by search text', async () => {
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'The Great Novel',
      });
      await insertTestNovel(testDb, { inLibrary: true, name: 'Another Story' });

      const novels = await getLibraryNovelsFromDb(
        undefined,
        undefined,
        'Great',
      );
      expect(novels).toHaveLength(1);
      expect(novels[0].name).toBe('The Great Novel');
    });

    it('should filter by downloadedOnlyMode', async () => {
      const novelAId = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel A',
        isLocal: false,
      });
      await insertTestChapter(testDb, novelAId, { isDownloaded: true });
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel B',
        isLocal: true,
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel C',
        isLocal: false,
      }); // Not downloaded

      const novels = await getLibraryNovelsFromDb(
        undefined,
        undefined,
        undefined,
        true,
      );
      expect(novels).toHaveLength(2);
      expect(novels.map(n => n.name)).toEqual(['Novel A', 'Novel B']);
    });

    it('should filter by excludeLocalNovels', async () => {
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel A',
        isLocal: true,
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel B',
        isLocal: false,
      });

      const novels = await getLibraryNovelsFromDb(
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      );
      expect(novels).toHaveLength(1);
      expect(novels[0].name).toBe('Novel B');
    });

    it('should combine all filters (sort, search, downloaded only, exclude local)', async () => {
      // Setup: Insert multiple novels with varying properties
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'The Great Local Novel',
        author: 'Author One',
        isLocal: true,
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 2',
        isLocal: false,
      });
      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });
      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId2, categoryId1);

      const novels = await getLibraryWithCategory(categoryId1, true);
      expect(novels).toHaveLength(1);
      expect(novels[0].name).toBe('Novel 2');
    });

    it('should not filter by excludeLocalNovels = false', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
        isLocal: true,
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 2',
        isLocal: false,
      });
      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });
      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId2, categoryId1);

      const novels = await getLibraryWithCategory(categoryId1, false);
      expect(novels).toHaveLength(2);
      expect(novels.map(n => n.name).sort()).toEqual(['Novel 1', 'Novel 2']);
    });

    it('should handle novels belonging to multiple categories', async () => {
      // Test Case 1: Filter by remote novels with downloaded chapters
      const novel1Id = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'A Good Remote Story',
        author: 'Author Two',
        isLocal: false,
      });
      await insertTestChapter(testDb, novel1Id, { isDownloaded: true });

      // Novel 2: Remote but not downloaded
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Another Remote Novel',
        author: 'Author Three',
        isLocal: false,
      });

      // Novel 3: Downloaded but not matching author filter
      await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Downloaded Book',
        author: 'Author One',
        isLocal: false,
      }); // No chapters, so chaptersDownloaded is 0

      const novels1 = await getLibraryNovelsFromDb(
        'name ASC', // sortOrder
        "author = 'Author Two'", // filter
        'Remote', // searchText
        true, // downloadedOnlyMode
        true, // excludeLocalNovels
      );
      expect(novels1).toHaveLength(1);
      expect(novels1[0].name).toBe('A Good Remote Story');

      // Test Case 2: Filter by local novels with downloaded chapters by Author One
      const novel2Id = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'An Old Local Story',
        author: 'Author One',
        isLocal: true,
      });
      await insertTestChapter(testDb, novel2Id, { isDownloaded: true });

      const novel3Id = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'The Great Local Novel',
        author: 'Author One',
        isLocal: true,
      });
      await insertTestChapter(testDb, novel3Id, { isDownloaded: true });

      const novels2 = await getLibraryNovelsFromDb(
        'name DESC',
        "author = 'Author One'",
        'Local',
        true,
        false, // Include local novels
      );

      // Both are local, by Author One, and have downloaded chapters.
      // Sorted DESC, so 'The Great Local Novel' comes first.
      expect(novels2.map(n => n.name)).toEqual([
        'The Great Local Novel',
        'An Old Local Story',
      ]);

      // Test Case 3: Combination leading to empty results
      const novels3 = await getLibraryNovelsFromDb(
        'name ASC',
        "author = 'NonExistent'",
        'Novel',
        false,
        false,
      );
      expect(novels3).toHaveLength(0);
    });

    it('should return empty array if no novels match filters', async () => {
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel A' });

      const novels = await getLibraryNovelsFromDb(
        undefined,
        "author = 'NonExistent'",
      );
      expect(novels).toHaveLength(0);
    });

    it('should return empty array if no novels in library', async () => {
      await insertTestNovel(testDb, { inLibrary: false, name: 'Novel A' });

      const novels = await getLibraryNovelsFromDb();
      expect(novels).toHaveLength(0);
    });
  });

  describe('getLibraryNovelsForGlobalUpdate', () => {
    it('includes only novels in selected categories', async () => {
      const includedNovelId = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Included Novel',
      });
      const otherNovelId = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Other Novel',
      });
      const includedCategoryId = await insertTestCategory(testDb, {
        name: 'Included',
      });
      const otherCategoryId = await insertTestCategory(testDb, {
        name: 'Other',
      });
      await insertTestNovelCategory(
        testDb,
        includedNovelId,
        includedCategoryId,
      );
      await insertTestNovelCategory(testDb, otherNovelId, otherCategoryId);

      const novels = await getLibraryNovelsForGlobalUpdate({
        includedCategoryIds: [includedCategoryId],
        excludedCategoryIds: [],
      });

      expect(novels.map(novel => novel.name)).toEqual(['Included Novel']);
    });

    it('gives excluded categories precedence over included categories', async () => {
      const excludedNovelId = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Excluded Novel',
      });
      const includedNovelId = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Included Novel',
      });
      const includedCategoryId = await insertTestCategory(testDb, {
        name: 'Included',
      });
      const excludedCategoryId = await insertTestCategory(testDb, {
        name: 'Excluded',
      });
      await insertTestNovelCategory(
        testDb,
        excludedNovelId,
        includedCategoryId,
      );
      await insertTestNovelCategory(
        testDb,
        excludedNovelId,
        excludedCategoryId,
      );
      await insertTestNovelCategory(
        testDb,
        includedNovelId,
        includedCategoryId,
      );

      const novels = await getLibraryNovelsForGlobalUpdate({
        includedCategoryIds: [includedCategoryId],
        excludedCategoryIds: [excludedCategoryId],
      });

      expect(novels.map(novel => novel.name)).toEqual(['Included Novel']);
    });

    it('excludes local novels without filtering by status', async () => {
      await insertTestNovel(testDb, {
        inLibrary: true,
        isLocal: false,
        name: 'Ongoing Novel',
        status: 'Ongoing',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        isLocal: false,
        name: 'Completed Novel',
        status: 'Completed',
      });
      await insertTestNovel(testDb, {
        inLibrary: true,
        isLocal: true,
        name: 'Local Novel',
        status: 'Ongoing',
      });

      const novels = await getLibraryNovelsForGlobalUpdate({
        includedCategoryIds: [],
        excludedCategoryIds: [],
      });

      expect(novels.map(novel => novel.name)).toEqual([
        'Ongoing Novel',
        'Completed Novel',
      ]);
    });

    it('applies all smart update skip filters', async () => {
      await insertTestNovel(testDb, {
        chaptersUnread: 0,
        inLibrary: true,
        isLocal: false,
        lastReadAt: '2026-07-25',
        name: 'Eligible Novel',
        status: 'Ongoing',
      });
      await insertTestNovel(testDb, {
        chaptersUnread: 2,
        inLibrary: true,
        isLocal: false,
        lastReadAt: '2026-07-25',
        name: 'Unread Chapters',
        status: 'Ongoing',
      });
      await insertTestNovel(testDb, {
        chaptersUnread: 0,
        inLibrary: true,
        isLocal: false,
        lastReadAt: null,
        name: 'Unstarted Novel',
        status: 'Ongoing',
      });
      await insertTestNovel(testDb, {
        chaptersUnread: 0,
        inLibrary: true,
        isLocal: false,
        lastReadAt: '2026-07-25',
        name: 'Completed Novel',
        status: 'Completed',
      });

      const novels = await getLibraryNovelsForGlobalUpdate(
        {
          includedCategoryIds: [],
          excludedCategoryIds: [],
        },
        {
          skipCompleted: true,
          skipUnstarted: true,
          skipWithUnread: true,
        },
      );

      expect(novels.map(novel => novel.name)).toEqual(['Eligible Novel']);
    });
  });

  describe('getLibraryWithCategory', () => {
    it('should return novels in a specific category', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 2',
      });
      const novelId3 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 3',
      });

      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });
      const categoryId2 = await insertTestCategory(testDb, {
        name: 'Category B',
      });

      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId2, categoryId1);
      await insertTestNovelCategory(testDb, novelId3, categoryId2);

      const novels = await getLibraryWithCategory(categoryId1);
      expect(novels).toHaveLength(2);
      expect(novels.map(n => n.name).sort()).toEqual(['Novel 1', 'Novel 2']);
    });

    it('should return novels only if in library', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: false,
        name: 'Novel 2',
      });

      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });

      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId2, categoryId1);

      const novels = await getLibraryWithCategory(categoryId1);
      expect(novels).toHaveLength(1);
      expect(novels[0].name).toBe('Novel 1');
    });

    it('should return empty array if category has no novels', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
      });
      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });
      const categoryId2 = await insertTestCategory(testDb, {
        name: 'Category B',
      });

      await insertTestNovelCategory(testDb, novelId1, categoryId1);

      const novels = await getLibraryWithCategory(categoryId2);
      expect(novels).toHaveLength(0);
    });

    it('should return empty array if no novels match category or other filters', async () => {
      // Insert novels, but none matching a specific category or filters
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel 1' });
      await insertTestNovel(testDb, { inLibrary: true, name: 'Novel 2' });

      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });

      // No novel-category associations made for categoryId1

      const novels = await getLibraryWithCategory(categoryId1);
      expect(novels).toHaveLength(0);
    });

    it('should return empty array if initial category ID query returns no idRows', async () => {
      // No novels or categories inserted, or a non-existent category ID
      const novels = await getLibraryWithCategory(999); // Non-existent category
      expect(novels).toHaveLength(0);
    });

    it('should filter by excludeLocalNovels = true', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
        isLocal: true,
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 2',
        isLocal: false,
      });
      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });
      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId2, categoryId1);

      const novels = await getLibraryWithCategory(categoryId1, true);
      expect(novels).toHaveLength(1);
      expect(novels[0].name).toBe('Novel 2');
    });

    it('should not filter by excludeLocalNovels = false', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
        isLocal: true,
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 2',
        isLocal: false,
      });
      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });
      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId2, categoryId1);

      const novels = await getLibraryWithCategory(categoryId1, false);
      expect(novels).toHaveLength(2);
      expect(novels.map(n => n.name).sort()).toEqual(['Novel 1', 'Novel 2']);
    });

    it('should handle novels belonging to multiple categories', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 2',
      });

      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });
      const categoryId2 = await insertTestCategory(testDb, {
        name: 'Category B',
      });

      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId1, categoryId2); // Novel 1 in two categories
      await insertTestNovelCategory(testDb, novelId2, categoryId2);

      const novelsCat1 = await getLibraryWithCategory(categoryId1);
      expect(novelsCat1).toHaveLength(1);
      expect(novelsCat1[0].name).toBe('Novel 1');

      const novelsCat2 = await getLibraryWithCategory(categoryId2);
      expect(novelsCat2).toHaveLength(2);
      expect(novelsCat2.map(n => n.name).sort()).toEqual([
        'Novel 1',
        'Novel 2',
      ]);
    });

    it('should return all library novels if categoryId is null', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 2',
      });
      await insertTestNovel(testDb, { inLibrary: false, name: 'Novel 3' });

      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });

      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId2, categoryId1);

      const novels = await getLibraryWithCategory(null);
      expect(novels).toHaveLength(2);
      expect(novels.map(n => n.name).sort()).toEqual(['Novel 1', 'Novel 2']);
    });

    it('should return all library novels if categoryId is undefined', async () => {
      const novelId1 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 1',
      });
      const novelId2 = await insertTestNovel(testDb, {
        inLibrary: true,
        name: 'Novel 2',
      });
      await insertTestNovel(testDb, { inLibrary: false, name: 'Novel 3' });

      const categoryId1 = await insertTestCategory(testDb, {
        name: 'Category A',
      });

      await insertTestNovelCategory(testDb, novelId1, categoryId1);
      await insertTestNovelCategory(testDb, novelId2, categoryId1);

      const novels = await getLibraryWithCategory(undefined);
      expect(novels).toHaveLength(2);
      expect(novels.map(n => n.name).sort()).toEqual(['Novel 1', 'Novel 2']);
    });
  });
});
