/**
 * Test setup file for database query tests
 *
 * This file sets up a real in-memory SQLite database for testing.
 * Tests verify actual data returned by queries, not just function calls.
 */

// @ts-ignore
global.__DEV__ ??= false;

import type { TestDb } from './testDb';

const getTestDbModule = () => require('./testDb') as typeof import('./testDb');

// Module-level variable to hold the test database
// Using 'mock' prefix so Jest allows it in jest.mock() factory
let mockTestDbInstance: TestDb | null = null;

/**
 * Sets up the test database
 * This should be called in beforeEach of test files
 */
export function setupTestDatabase(): TestDb {
  const { createTestDb, cleanupTestDb } = getTestDbModule();
  if (mockTestDbInstance) {
    cleanupTestDb(mockTestDbInstance);
  }
  mockTestDbInstance = createTestDb();
  return mockTestDbInstance;
}

/**
 * Gets the current test database instance
 */
export function getTestDb(): TestDb {
  if (!mockTestDbInstance) {
    throw new Error(
      'Test database not initialized. Call setupTestDatabase() first.',
    );
  }
  return mockTestDbInstance;
}

/**
 * Cleans up the test database
 */
export function teardownTestDatabase() {
  const { cleanupTestDb } = getTestDbModule();
  if (mockTestDbInstance) {
    cleanupTestDb(mockTestDbInstance);
    mockTestDbInstance = null;
  }
}

// Mock utility functions (still needed for tests)
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

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/mock/novel/storage',
}));

// Mock NativeFile
jest.mock('@modules/native-file', () => ({
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

// Mock plugin-related modules
jest.mock('@plugins/helpers/fetch', () => ({
  downloadFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: jest.fn().mockReturnValue({
    imageRequestInit: undefined,
  }),
}));

jest.mock('@services/plugin/fetch', () => ({
  fetchNovel: jest.fn().mockResolvedValue({
    path: '/test/novel',
    name: 'Test Novel',
    cover: 'https://example.com/cover.png',
    summary: 'Test summary',
    author: 'Test Author',
    artist: 'Test Artist',
    status: 'Ongoing',
    genres: 'Fantasy, Adventure',
    totalPages: 1,
    chapters: [],
  }),
}));

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({
    canceled: true,
    assets: null,
  }),
}));

// Mock lodash-es to avoid ES module issues
jest.mock('lodash-es', () => {
  const lodash = jest.requireActual('lodash');
  return {
    ...lodash,
    countBy: lodash.countBy,
  };
});

// Global test timeout
jest.setTimeout(10000);

// Note: Each test file should call setupTestDatabase() in beforeEach
// and clearAllTables() if needed for proper test isolation
// The database is automatically cleaned up in afterAll
afterAll(() => {
  teardownTestDatabase();
});
