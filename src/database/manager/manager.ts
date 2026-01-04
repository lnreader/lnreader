import { db, drizzleDb } from '@database/db';
import { IDbManager } from './manager.d';
import { DbTaskQueue } from './queue';
import { Schema } from '../schema';
import { useEffect, useState } from 'react';
import { GetSelectTableName } from 'drizzle-orm/query-builders/select.types';
import { SQLBatchTuple } from 'node_modules/@op-engineering/op-sqlite/lib/typescript/src';
import { Query } from 'node_modules/drizzle-orm';

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

  private constructor(db: DrizzleDb) {
    this.db = db;
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

  public static create(db: DrizzleDb): DbManager {
    if (_dbManager) return _dbManager;
    _dbManager = new DbManager(db);
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

  public async batch(commands: SQLBatchTuple[]) {
    return await db.executeBatch(commands);
  }

  public async write<T>(
    fn: (tx: TransactionParameter) => Promise<T>,
  ): Promise<T> {
    return await this.queue.enqueue({
      id: 'write',
      run: async () =>
        await this.db.transaction(async tx => {
          console.log('Transaction started');
          const result = await fn(tx);
          db?.flushPendingReactiveQueries();
          return result;
        }),
    });
  }
}

export const createDbManager = (db: DrizzleDb) => {
  return DbManager.create(db);
};

type TableNames = GetSelectTableName<Schema[keyof Schema]>;
type FireOn = Array<{ table: TableNames; ids?: number[] }>;

export function useLiveQueryy<T extends ExecutableSelect>(
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
      console.log('result', result);
      setData(result.rows);
    },
  });

  useEffect(() => {
    return () => {
      console.log('unsub');
      unsub();
    };
  }, []);
  return data;
}
