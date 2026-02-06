const mockGetTestDb = () =>
  (require('./setup') as typeof import('./setup')).getTestDb();

// Mock @database/db to use our test database
jest.mock('@database/db', () => {
  return {
    __esModule: true,
    get db() {
      return mockGetTestDb().sqlite;
    },
    get drizzleDb() {
      return mockGetTestDb().drizzleDb;
    },
    get dbManager() {
      return mockGetTestDb().dbManager;
    },
    useInitDatabase: jest.fn(),
    recreateDatabaseIndexes: jest.fn(),
  };
});
