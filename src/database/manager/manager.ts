import { db, drizzleDb } from '@database/db';
import { IDbManager } from './manager.d';
import { DbTaskQueue } from './queue';
import { Schema } from '../schema';
import { useEffect, useState } from 'react';
import { GetSelectTableName } from 'drizzle-orm/query-builders/select.types';
import { Placeholder, Query, sql } from 'drizzle-orm';
import { SQLitePreparedQuery } from 'drizzle-orm/sqlite-core';

type DrizzleDb = typeof drizzleDb;
type TransactionParameter = Parameters<
  Parameters<DrizzleDb['transaction']>[0]
>[0];

interface ExecutableSelect<TResult = any> {
  toSQL(): Query;
  all(): Promise<TResult[]>; // Or TResult[] if you are using a synchronous driver
  get(): Promise<TResult | undefined>;
}

let _dbManager: DbManager;

class DbManager implements IDbManager {
  private readonly db: DrizzleDb;
  private readonly queue: DbTaskQueue;

  public readonly select: DrizzleDb['select'];
  public readonly selectDistinct: DrizzleDb['selectDistinct'];
  public readonly $count: DrizzleDb['$count'];
  public readonly query: DrizzleDb['query'];
  public readonly run: DrizzleDb['run'];
  public readonly transaction: DrizzleDb['transaction'];
  public readonly with: DrizzleDb['with'];
  public readonly $with: DrizzleDb['$with'];
  public readonly all: DrizzleDb['all'];
  public readonly get: DrizzleDb['get'];
  public readonly values: DrizzleDb['values'];

  private constructor(dbInstance: DrizzleDb) {
    this.db = dbInstance;
    this.queue = new DbTaskQueue();
    this.select = this.db.select.bind(this.db);
    this.selectDistinct = this.db.selectDistinct.bind(this.db);
    this.$count = this.db.$count.bind(this.db);
    this.query = this.db.query;
    this.run = this.db.run.bind(this.db);
    this.transaction = this.db.transaction.bind(this.db);
    this.with = this.db.with.bind(this.db);
    this.$with = this.db.$with.bind(this.db);
    this.all = this.db.all.bind(this.db);
    this.get = this.db.get.bind(this.db);
    this.values = this.db.values.bind(this.db);
  }

  public static create(dbInstance: DrizzleDb): DbManager {
    if (_dbManager) return _dbManager;
    _dbManager = new DbManager(dbInstance);
    return _dbManager;
  }

  public getSync<T extends ExecutableSelect>(
    query: T,
  ): Awaited<ReturnType<T['get']>> {
    const { sql, params } = query.toSQL();
    return db.executeSync(sql, params as any[]).rows[0] as Awaited<
      ReturnType<T['get']>
    >;
  }

  public async allSync<T extends ExecutableSelect>(
    query: T,
  ): Promise<Awaited<ReturnType<T['all']>>> {
    const { sql, params } = query.toSQL();
    return db.executeSync(sql, params as any[]).rows as Awaited<
      ReturnType<T['all']>
    >;
  }

  /**
   * Efficiently executes a Drizzle query for multiple data rows using a single
   * prepared statement within a write transaction.
   *
   * @param data - Array of objects containing the parameters for each execution.
   * @param fn - Callback to build the query. Use `ph("key")` to bind to properties in your data.
   *             Must return a prepared query via `.prepare()`.
   *
   * @example
   * await dbManager.batch(
   *   [{ id: 1, val: 'a' }, { id: 2, val: 'b' }],
   *   (tx, ph) => tx.insert(table).values({ id: ph('id'), val: ph('val') }).prepare()
   * );
   */
  public async batch<T extends Record<string, unknown>>(
    data: T[],
    fn: (
      tx: TransactionParameter,
      ph: (arg: Extract<keyof T, string>) => Placeholder,
    ) => SQLitePreparedQuery<any>,
  ) {
    const ph = (arg: Extract<keyof T, string>) => sql.placeholder(arg);
    await this.write(async tx => {
      const prep = fn(tx, ph);
      for (let index = 0; index < data.length; index++) {
        prep.run(data[index]);
      }
    });
  }

  public async write<T>(
    fn: (tx: TransactionParameter) => Promise<T>,
  ): Promise<T> {
    return await this.queue.enqueue({
      id: 'write',
      run: async () =>
        await this.db.transaction(async tx => {
          const result = await fn(tx);
          db?.flushPendingReactiveQueries();
          return result;
        }),
    });
  }
}

export const createDbManager = (dbInstance: DrizzleDb) => {
  return DbManager.create(dbInstance);
};

type TableNames = GetSelectTableName<Schema[keyof Schema]>;
type FireOn = Array<{ table: TableNames; ids?: number[] }>;

export function useLiveQuery<T extends ExecutableSelect>(
  query: T,
  fireOn: FireOn,
) {
  type ReturnValue = Awaited<ReturnType<T['all']>>;
  const { sql, params } = query.toSQL();
  const [data, setData] = useState<ReturnValue | []>(
    db.executeSync(sql, params as any[]).rows as ReturnValue,
  );

  const unsub = db.reactiveExecute({
    query: sql,
    arguments: params,
    fireOn,
    callback: result => {
      setData(result.rows);
    },
  });

  useEffect(() => {
    return () => {
      unsub();
    };
  }, [unsub]);
  return data;
}
