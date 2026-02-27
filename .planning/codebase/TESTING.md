# Testing Patterns

**Analysis Date:** 2026-02-27

## Test Framework

**Runner:**

- Jest 29.7.0
- Config: `jest.config.js`
- Environment: node (for database tests)

**Assertion Library:**

- Jest built-in expect

**Run Commands:**

```bash
pnpm test                 # Run all tests
pnpm test:watch          # Watch mode
pnpm test:coverage       # With coverage report
pnpm test:queries        # Run only query tests
```

## Test File Organization

**Location:**

- Co-located with source files in `__tests__` directories
- Test pattern: `**/__tests__/**/*.test.ts`, `**/__tests__/**/*.test.tsx`

**Naming:**

- Test files match source: `NovelQueries.ts` → `NovelQueries.test.ts`
- Location: `src/database/queries/__tests__/`

**Structure:**

```
src/database/queries/__tests__/
├── setup.ts              # Global test setup
├── testDb.ts             # Test database creation
├── mockDb.ts             # Database mocking
├── testData.ts           # Test fixtures and helpers
├── NovelQueries.test.ts
├── ChapterQueries.test.ts
├── CategoryQueries.test.ts
└── ...
```

## Test Structure

**Suite Organization:**

```typescript
import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { clearAllTables, insertTestNovel } from './testData';
import { categorySchema, novelCategorySchema } from '@database/schema';

import { getAllNovels, getNovelById } from '../NovelQueries';

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
});
```

**Patterns:**

- Setup in `beforeEach` - creates fresh test database per test
- Cleanup in `afterAll` - tears down after all tests complete
- Use `clearAllTables()` for test isolation
- Get test DB via `getTestDb()` helper

## Mocking

**Framework:** Jest

**Patterns:**

- Global mocks in `setup.ts` using `jest.mock()`:

```typescript
jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@utils/error', () => ({
  getErrorMessage: jest.fn(
    (error: any) => error?.message || String(error) || 'Unknown error',
  ),
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn((key: string) => key),
}));

jest.mock('@specs/NativeFile', () => ({
  __esModule: true,
  default: {
    exists: jest.fn().mockReturnValue(true),
    mkdir: jest.fn(),
    unlink: jest.fn(),
    copyFile: jest.fn(),
    readFile: jest.fn().mockReturnValue(''),
    writeFile: jest.fn(),
  },
}));
```

- Mock modules that require native code (React Native, Expo, etc.)
- Use `jest.mocked()` for typing:

```typescript
const { fetchNovel } = require('@services/plugin/fetch');
jest.mocked(fetchNovel).mockResolvedValueOnce({
  path: '/test/novel',
  name: 'Test Novel',
  chapters: [],
});
```

**What to Mock:**

- Native modules (NativeFile, Expo modules)
- External services (plugin fetch)
- UI libraries (toast, notifications)
- Database (in test mode, use real in-memory DB)

**What NOT to Mock:**

- Database queries themselves - test against real in-memory SQLite
- Drizzle ORM operations

## Fixtures and Factories

**Test Data:**

- Helper functions in `testData.ts`:

```typescript
export async function insertTestNovel(
  testDb: TestDb,
  data: Partial<NovelInsert> = {},
): Promise<number> {
  const { drizzleDb } = testDb;
  const novelData: any = {
    path: `/test/novel/${Math.random()}`,
    pluginId: 'test-plugin',
    name: 'Test Novel',
    cover: null,
    // ... default values
    ...data,
  };
  const result = drizzleDb.insert(novelSchema).values(novelData).returning().get();
  return result.id;
}

export async function insertTestChapter(
  testDb: TestDb,
  novelId: number,
  data: Partial<ChapterInsert> = {},
): Promise<number> {...}

export async function insertTestCategory(
  testDb: TestDb,
  data: Partial<CategoryInsert> = {},
): Promise<number> {...}
```

**Location:** `src/database/queries/__tests__/testData.ts`

**Factory Patterns:**

- Partial data override with spread operator
- Default values for required fields
- Random paths using `Math.random()` to avoid conflicts

## Coverage

**Requirements:** Not strictly enforced, but tracked

**View Coverage:**

```bash
pnpm test:coverage
```

**Config (from jest.config.js):**

```javascript
collectCoverageFrom: [
  'src/database/queries/**/*.ts',
  '!src/database/queries/**/__tests__/**',
],
coverageDirectory: 'coverage',
coverageReporters: ['text', 'lcov', 'html'],
```

## Test Types

**Unit Tests:**

- Focus on database query functions
- Use real in-memory SQLite (better-sqlite3)
- Test actual returned data, not just function calls

**Integration Tests:**

- Test transactions and multi-table operations
- Verify foreign key relationships
- Test category associations, novel-chapter relationships

**Database Setup:**

```typescript
// testDb.ts - creates in-memory SQLite
import Database from 'better-sqlite3';

export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  // Initialize schema
  sqlite.exec(schema);
  return { sqlite, drizzleDb };
}
```

## Common Patterns

**Async Testing:**

```typescript
it('should insert novel and chapters', async () => {
  const sourceNovel = {
    path: '/test/novel',
    name: 'Test Novel',
    chapters: [{ path: '/chapter/1', name: 'Chapter 1', page: '1' }],
  };

  const novelId = await insertNovelAndChapters('test-plugin', sourceNovel);

  expect(novelId).toBeDefined();
  const novel = await getNovelById(novelId!);
  expect(novel?.name).toBe('Test Novel');
});
```

**Error Testing:**

```typescript
it('should return undefined when novel not found', async () => {
  const result = await getNovelById(999);
  expect(result).toBeUndefined();
});

it('should handle empty array', async () => {
  await expect(removeNovelsFromLibrary([])).resolves.not.toThrow();
});
```

**Mocking External Dependencies:**

```typescript
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({
    canceled: true,
    assets: null,
  }),
}));
```

**Test Isolation:**

- Each test gets fresh database via `clearAllTables()`
- Use random data to prevent test pollution
- Clean up in `afterAll`

## Jest Configuration

**Key Settings (from jest.config.js):**

```javascript
testEnvironment: 'node',
roots: ['<rootDir>/src'],
testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
transform: { '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest' },
transformIgnorePatterns: [
  'node_modules/(?!(react-native|@react-native|@react-navigation|expo|expo-.*|@expo|drizzle-orm|lodash-es)/)',
],
moduleNameMapper: {
  // Path aliases
},
setupFilesAfterEnv: ['<rootDir>/src/database/queries/__tests__/setup.ts'],
testTimeout: 10000,
clearMocks: true,
resetMocks: true,
restoreMocks: true,
```

---

_Testing analysis: 2026-02-27_
