/**
 * Test-specific dbManager implementation for better-sqlite3
 * Provides compatibility with op-sqlite specific methods
 */

import type { IDbManager } from '@database/manager/manager.d';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

interface ExecutableSelect<TResult = any> {
  toSQL(): { sql: string; params: unknown[] };
  get(): Promise<TResult | undefined>;
  all(): Promise<TResult[]>;
}

type DrizzleDb = BetterSQLite3Database<any>;
type TransactionParameter = Parameters<
  Parameters<DrizzleDb['transaction']>[0]
>[0];

/**
 * Creates a test-compatible dbManager that works with better-sqlite3
 */
export function createTestDbManager(
  drizzleDb: DrizzleDb,
  sqlite: Database.Database,
): IDbManager {
  // Create a wrapper that implements the IDbManager interface
  const dbManager = {
    // Drizzle methods - delegate to drizzleDb
    select: drizzleDb.select.bind(drizzleDb),
    selectDistinct: drizzleDb.selectDistinct.bind(drizzleDb),
    $count: drizzleDb.$count.bind(drizzleDb),
    query: drizzleDb.query,
    run: drizzleDb.run.bind(drizzleDb),
    transaction: drizzleDb.transaction.bind(drizzleDb),
    with: drizzleDb.with.bind(drizzleDb),
    $with: drizzleDb.$with.bind(drizzleDb),
    all: drizzleDb.all.bind(drizzleDb),
    get: drizzleDb.get.bind(drizzleDb),
    values: drizzleDb.values.bind(drizzleDb),

    // Test-compatible implementations of op-sqlite specific methods
    getSync<T extends ExecutableSelect>(
      query: T,
    ): Awaited<ReturnType<T['get']>> {
      const { sql, params } = query.toSQL();
      const stmt = sqlite.prepare(sql);
      const result = stmt.get(params as any[]) as Awaited<ReturnType<T['get']>>;
      return result;
    },

    async allSync<T extends ExecutableSelect>(
      query: T,
    ): Promise<Awaited<ReturnType<T['all']>>> {
      const { sql, params } = query.toSQL();
      const stmt = sqlite.prepare(sql);
      const results = stmt.all(params as any[]) as Awaited<
        ReturnType<T['all']>
      >;
      return results;
    },

    async batch(commands: Array<{ sql: string; args: unknown[] }>) {
      // better-sqlite3 doesn't have executeBatch, so we execute sequentially
      const transaction = sqlite.transaction((cmds: typeof commands) => {
        for (const cmd of cmds) {
          const stmt = sqlite.prepare(cmd.sql);
          stmt.run(cmd.args as any[]);
        }
      });
      transaction(commands);
    },

    async write<T>(fn: (tx: TransactionParameter) => Promise<T>): Promise<T> {
      const result = await fn(drizzleDb as any);
      // No-op for better-sqlite3 (no reactive queries)
      return result;
      // For tests, we can use transactions directly without the queue
      return await drizzleDb.transaction(async tx => {
        const result = await fn(tx);
        // No-op for better-sqlite3 (no reactive queries)
        return result;
      });
    },
  };

  return dbManager;
}
