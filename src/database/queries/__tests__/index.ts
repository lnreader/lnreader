/**
 * Database Query Tests
 *
 * This test suite covers all database query modules in the lnreader application.
 * The queries are currently in a migration process from raw SQLite to Drizzle ORM,
 * so some tests may not pass until the migration is complete.
 *
 * Test Files:
 * - CategoryQueries.test.ts - Tests for category CRUD operations
 * - ChapterQueries.test.ts - Tests for chapter management and reading progress
 * - HistoryQueries.test.ts - Tests for reading history tracking
 * - LibraryQueries.test.ts - Tests for library novel retrieval and filtering
 * - NovelQueries.test.ts - Tests for novel CRUD and library management
 * - RepositoryQueries.test.ts - Tests for plugin repository management
 * - StatsQueries.test.ts - Tests for library statistics
 *
 * Running Tests:
 * - `pnpm test` - Run all tests
 * - `pnpm test:watch` - Run tests in watch mode
 * - `pnpm test:coverage` - Run tests with coverage report
 * - `pnpm test:queries` - Run only database query tests
 *
 * Test Setup:
 * The setup.ts file provides:
 * - Mock implementations for dbManager and database operations
 * - Mock schemas for all database tables
 * - Test fixtures for creating test data
 * - Helper functions for resetting mocks between tests
 *
 * @module database/queries/__tests__
 */

// Export test utilities for external use
export { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
export {
  insertTestNovel,
  insertTestChapter,
  insertTestCategory,
  insertTestRepository,
  insertTestNovelCategory,
  clearAllTables,
  seedTestData,
} from './testData';
export { createTestDb, cleanupTestDb, getTestDbManager } from './testDb';

// Test module descriptions for documentation purposes
export const testModules = {
  CategoryQueries: {
    description: 'Category management operations',
    functions: [
      'getCategoriesFromDb',
      'getCategoriesWithCount',
      'createCategory',
      'deleteCategoryById',
      'updateCategory',
      'isCategoryNameDuplicate',
      'updateCategoryOrderInDb',
      'getAllNovelCategories',
      '_restoreCategory',
    ],
  },
  ChapterQueries: {
    description: 'Chapter management and reading progress',
    functions: [
      'insertChapters',
      'markChapterRead',
      'markChaptersRead',
      'markChapterUnread',
      'markChaptersUnread',
      'markAllChaptersRead',
      'markAllChaptersUnread',
      'deleteChapter',
      'deleteChapters',
      'deleteDownloads',
      'deleteReadChaptersFromDb',
      'updateChapterProgress',
      'updateChapterProgressByIds',
      'bookmarkChapter',
      'markPreviuschaptersRead',
      'markPreviousChaptersUnread',
      'clearUpdates',
      'getCustomPages',
      'getNovelChapters',
      'getUnreadNovelChapters',
      'getAllUndownloadedChapters',
      'getAllUndownloadedAndUnreadChapters',
      'getChapter',
      'getPageChapters',
      'getChapterCount',
      'getPageChaptersBatched',
      'getPrevChapter',
      'getNextChapter',
      'getDownloadedChapters',
      'getNovelDownloadedChapters',
      'getUpdatedOverviewFromDb',
      'getDetailedUpdatesFromDb',
      'isChapterDownloaded',
    ],
  },
  HistoryQueries: {
    description: 'Reading history tracking',
    functions: [
      'getHistoryFromDb',
      'insertHistory',
      'deleteChapterHistory',
      'deleteAllHistory',
    ],
  },
  LibraryQueries: {
    description: 'Library novel retrieval and filtering',
    functions: ['getLibraryNovelsFromDb', 'getLibraryWithCategory'],
  },
  NovelQueries: {
    description: 'Novel CRUD and library management',
    functions: [
      'insertNovelAndChapters',
      'getAllNovels',
      'getNovelById',
      'getNovelByPath',
      'switchNovelToLibraryQuery',
      'removeNovelsFromLibrary',
      'getCachedNovels',
      'deleteCachedNovels',
      'restoreLibrary',
      'updateNovelInfo',
      'pickCustomNovelCover',
      'updateNovelCategoryById',
      'updateNovelCategories',
      '_restoreNovelAndChapters',
    ],
  },
  RepositoryQueries: {
    description: 'Plugin repository management',
    functions: [
      'getRepositoriesFromDb',
      'isRepoUrlDuplicated',
      'createRepository',
      'deleteRepositoryById',
      'updateRepository',
    ],
  },
  StatsQueries: {
    description: 'Library statistics',
    functions: [
      'getLibraryStatsFromDb',
      'getChaptersTotalCountFromDb',
      'getChaptersReadCountFromDb',
      'getChaptersUnreadCountFromDb',
      'getChaptersDownloadedCountFromDb',
      'getNovelGenresFromDb',
      'getNovelStatusFromDb',
    ],
  },
} as const;

export type TestModuleName = keyof typeof testModules;
