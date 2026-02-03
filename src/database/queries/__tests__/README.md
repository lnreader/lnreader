# Database Queries Test Suite

This directory contains tests for all database query modules in the LNReader application. Tests use a real in-memory SQLite database to verify actual data returned by queries.

## Test Files

| File                        | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `CategoryQueries.test.ts`   | Tests for category CRUD operations                |
| `ChapterQueries.test.ts`    | Tests for chapter management and reading progress |
| `HistoryQueries.test.ts`    | Tests for reading history tracking                |
| `LibraryQueries.test.ts`    | Tests for library novel retrieval and filtering   |
| `NovelQueries.test.ts`      | Tests for novel CRUD and library management       |
| `RepositoryQueries.test.ts` | Tests for plugin repository management            |
| `StatsQueries.test.ts`      | Tests for library statistics                      |
| `setup.ts`                  | Test setup with real database                     |
| `testDb.ts`                 | Test database factory (better-sqlite3)            |
| `testData.ts`               | Test data insertion utilities                     |

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run only database query tests
pnpm test:queries
```

## Test Setup

The test suite uses **better-sqlite3** with an in-memory database to execute real queries. This ensures tests verify actual data correctness, not just function calls.

### Async mismatch detection

The test dbManager intentionally wraps Drizzle query builders so `.get()` and `.all()` behave like op-sqlite (async). If any query function treats these results synchronously (e.g. `const result = query.get(); return !!result;`), the tests will fail and should be fixed by making the query function async-safe.

### Test Database Factory

The `testDb.ts` file provides:

- `createTestDb()` - Creates a fresh in-memory SQLite database with schema and migrations
- `cleanupTestDb()` - Properly closes the database
- `getTestDbManager()` - Gets the dbManager instance for the test database

### Test Data Utilities

The `testData.ts` file provides helper functions to insert test data:

```typescript
import { insertTestNovel, insertTestChapter, clearAllTables } from './testData';

// Insert a novel
const novelId = await insertTestNovel(testDb, {
  inLibrary: true,
  name: 'Test Novel',
  pluginId: 'test-plugin',
});

// Insert a chapter
const chapterId = await insertTestChapter(testDb, novelId, {
  name: 'Chapter 1',
  unread: true,
});

// Clear all tables between tests
clearAllTables(testDb);
```

Available utilities:

- `insertTestNovel()` - Insert a novel
- `insertTestChapter()` - Insert a chapter
- `insertTestCategory()` - Insert a category
- `insertTestRepository()` - Insert a repository
- `insertTestNovelCategory()` - Link novel to category
- `insertTestNovelWithChapters()` - Insert novel with chapters
- `seedTestData()` - Bulk insert test data
- `clearAllTables()` - Clean database between tests

## Writing New Tests

### Basic Test Structure

```typescript
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, clearAllTables } from './testData';
import { getLibraryStatsFromDb } from '../StatsQueries';

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

      // Insert test data
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

      // Execute query
      const result = await getLibraryStatsFromDb();

      // Verify actual data
      expect(result.novelsCount).toBe(2);
      expect(result.sourcesCount).toBe(2);
    });
  });
});
```

### Test Isolation

Each test file should:

1. Call `setupTestDatabase()` in `beforeEach` to create a fresh database
2. Call `clearAllTables()` if needed to clean up data between tests
3. Call `teardownTestDatabase()` in `afterAll` (handled automatically by setup.ts)

### Testing Write Operations

```typescript
it('should create a repository', async () => {
  const result = await createRepository('https://example.com/repo');

  // Verify the data was actually inserted
  expect(result).toBeDefined();
  expect(result.url).toBe('https://example.com/repo');
  expect(result.id).toBeGreaterThan(0);

  // Verify it can be retrieved
  const repositories = await getRepositoriesFromDb();
  expect(repositories).toContainEqual(
    expect.objectContaining({ url: 'https://example.com/repo' }),
  );
});
```

### Testing with Relationships

```typescript
it('should return chapters for a novel', async () => {
  const testDb = getTestDb();

  // Create novel
  const novelId = await insertTestNovel(testDb, {
    inLibrary: true,
  });

  // Create chapters
  await insertTestChapter(testDb, novelId, { name: 'Chapter 1' });
  await insertTestChapter(testDb, novelId, { name: 'Chapter 2' });

  // Query
  const chapters = await getNovelChapters(novelId);

  // Verify data
  expect(chapters).toHaveLength(2);
  expect(chapters.map(c => c.name)).toEqual(['Chapter 1', 'Chapter 2']);
});
```

## Key Principles

1. **Test actual data, not function calls** - Verify the data returned by queries is correct
2. **Use real database** - Tests run against a real in-memory SQLite database
3. **Test isolation** - Each test gets a fresh database or cleaned tables
4. **Focus on correctness** - Verify queries return expected data for given inputs

## Mocked Dependencies

The setup automatically mocks external dependencies that aren't database-related:

- `@utils/showToast` - Toast notifications
- `@strings/translations` - i18n translations
- `@specs/NativeFile` - Native file system operations
- `@plugins/helpers/fetch` - Download utilities
- `@services/plugin/fetch` - Novel fetching service
- `expo-document-picker` - Document picker

The `@database/db` module is mocked to use the test database instead of the production database.

## Query Modules Tested

### StatsQueries

- `getLibraryStatsFromDb` - Novel and source counts
- `getChaptersTotalCountFromDb` - Total chapter count
- `getChaptersReadCountFromDb` - Read chapter count
- `getChaptersUnreadCountFromDb` - Unread chapter count
- `getChaptersDownloadedCountFromDb` - Downloaded chapter count
- `getNovelGenresFromDb` - Genre distribution
- `getNovelStatusFromDb` - Status distribution

### RepositoryQueries

- `getRepositoriesFromDb` - Get all repositories
- `isRepoUrlDuplicated` - Check for duplicate URLs
- `createRepository` - Create repository
- `deleteRepositoryById` - Delete repository
- `updateRepository` - Update repository URL

### CategoryQueries

- `getCategoriesFromDb` - Get all categories with novel IDs
- `createCategory` - Create a new category
- `isCategoryNameDuplicate` - Check for duplicate names
- `updateCategory` - Update category name

### LibraryQueries

- `getLibraryNovelsFromDb` - Get library novels with filters
- `getLibraryWithCategory` - Get novels by category

### ChapterQueries

- `markChapterRead` - Mark chapter as read
- `markChapterUnread` - Mark chapter as unread
- `bookmarkChapter` - Bookmark a chapter
- `getNovelChapters` - Get chapters for a novel

### NovelQueries

- `getAllNovels` - Get all novels
- `getNovelById` - Get novel by ID
- `getNovelByPath` - Get novel by path and pluginId

### HistoryQueries

- `getHistoryFromDb` - Get reading history
- `insertHistory` - Add to reading history
- `deleteChapterHistory` - Remove chapter from history
- `deleteAllHistory` - Clear all history

## Troubleshooting

### Tests fail with "Test database not initialized"

Ensure you call `setupTestDatabase()` in `beforeEach`:

```typescript
beforeEach(() => {
  const testDb = setupTestDatabase();
  clearAllTables(testDb);
});
```

### Tests interfere with each other

Make sure to call `clearAllTables()` in `beforeEach` or create a fresh database for each test:

```typescript
beforeEach(() => {
  const testDb = setupTestDatabase();
  clearAllTables(testDb); // Clean up data
});
```

### Migration errors

The test database automatically runs migrations. If you see migration errors, ensure the migration files in `drizzle/` are valid SQL.

### better-sqlite3 native module issues

If you see errors about better-sqlite3 not being found, ensure it's installed:

```bash
pnpm install
```

On some systems, you may need to rebuild native modules:

```bash
pnpm rebuild better-sqlite3
```
