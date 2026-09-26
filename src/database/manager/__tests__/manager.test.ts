import {
  createTestDb,
  cleanupTestDb,
} from '@database/queries/__tests__/testDb';

describe('DbManager.executeBatch', () => {
  const testDb = createTestDb();
  const flushPendingReactiveQueries = jest.fn();

  afterAll(() => {
    cleanupTestDb(testDb);
  });

  beforeEach(() => {
    flushPendingReactiveQueries.mockClear();
    Object.defineProperty(testDb.sqlite, 'flushPendingReactiveQueries', {
      configurable: true,
      value: flushPendingReactiveQueries,
    });
    testDb.sqlite.executeSync('DROP TABLE IF EXISTS BatchTest');
    testDb.sqlite.executeSync('DROP TABLE IF EXISTS MissingBatchTable');
    testDb.sqlite.executeSync(
      'CREATE TABLE BatchTest (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)',
    );
  });

  it('executes heterogeneous and repeated-parameter commands atomically', async () => {
    const result = await testDb.dbManager.executeBatch([
      ['INSERT INTO BatchTest (value) VALUES (?)', [['first'], ['second']]],
      ['UPDATE BatchTest SET value = ? WHERE value = ?', ['updated', 'first']],
      ['DELETE FROM BatchTest WHERE value = ?', [['second']]],
    ]);

    expect(result.rowsAffected).toBe(4);
    expect(flushPendingReactiveQueries).toHaveBeenCalledTimes(1);
    expect(
      testDb.sqlite.executeSync('SELECT value FROM BatchTest').rows,
    ).toEqual([{ value: 'updated' }]);
  });

  it('rolls back every command when a later command fails', async () => {
    await expect(
      testDb.dbManager.executeBatch([
        ['INSERT INTO BatchTest (value) VALUES (?)', [['rolled back']]],
        ['INSERT INTO MissingBatchTable (value) VALUES (?)', [['failure']]],
      ]),
    ).rejects.toThrow('MissingBatchTable');

    expect(flushPendingReactiveQueries).not.toHaveBeenCalled();
    expect(testDb.sqlite.executeSync('SELECT * FROM BatchTest').rows).toEqual(
      [],
    );
  });

  it('does not flush for an empty batch', async () => {
    const result = await testDb.dbManager.executeBatch([]);

    expect(result).toEqual({ rowsAffected: 0 });
    expect(flushPendingReactiveQueries).not.toHaveBeenCalled();
  });
});
