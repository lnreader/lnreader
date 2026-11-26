/**
 * Tests for the migration persistence check against a real in-memory database.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, clearAllTables } from './testData';
import { isMigrationPersisted } from '@services/migrate/verifyMigration';

jest.mock('@hooks/persisted/useSettings', () => ({
  getLibraryDefaultCategoryId: () => undefined,
}));

describe('isMigrationPersisted', () => {
  beforeEach(() => {
    clearAllTables(setupTestDatabase());
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  const setup = async (destinationInLibrary: boolean) => {
    const testDb = getTestDb();
    const fromNovelId = await insertTestNovel(testDb, { inLibrary: true });
    await insertTestNovel(testDb, {
      path: '/to',
      pluginId: 'to-plugin',
      inLibrary: destinationInLibrary,
    });
    return {
      testDb,
      target: { fromNovelId, pluginId: 'to-plugin', toNovelPath: '/to' },
    };
  };

  it('is false while the source novel still exists', async () => {
    const { target } = await setup(true);

    expect(isMigrationPersisted(target)).toBe(false);
  });

  it('is false when the destination is not in the library', async () => {
    const { testDb, target } = await setup(false);
    testDb.sqlite.executeSync(`DELETE FROM Novel WHERE id = ?`, [
      target.fromNovelId,
    ]);

    expect(isMigrationPersisted(target)).toBe(false);
  });

  it('is true once the destination is in the library and the source is gone', async () => {
    const { testDb, target } = await setup(true);
    testDb.sqlite.executeSync(`DELETE FROM Novel WHERE id = ?`, [
      target.fromNovelId,
    ]);

    expect(isMigrationPersisted(target)).toBe(true);
  });

  it('is false when the destination novel does not exist', async () => {
    const { testDb, target } = await setup(true);
    testDb.sqlite.executeSync(`DELETE FROM Novel WHERE path = '/to'`);
    testDb.sqlite.executeSync(`DELETE FROM Novel WHERE id = ?`, [
      target.fromNovelId,
    ]);

    expect(isMigrationPersisted(target)).toBe(false);
  });
});
