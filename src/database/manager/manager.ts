import { db, drizzleDb } from '@database/db';
import type { SQLBatchTuple, Scalar } from '@op-engineering/op-sqlite';
import { IDbManager } from './manager.d';
import { DbTaskQueue } from './queue';
import { Schema } from '../schema';
import { useEffect, useRef, useState } from 'react';
import { GetSelectTableName } from 'drizzle-orm/query-builders/select.types';
import {
  AnyColumn,
  fillPlaceholders,
  Placeholder,
  Query,
  sql,
} from 'drizzle-orm';
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

let _dbManager: DbManager | undefined;

export const __resetDbManagerForTests = () => {
  _dbManager = undefined;
};

export function castInt(value: number | string | AnyColumn) {
  return sql`CAST(${value} AS INTEGER)`;
}

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
    const { sql: sqlString, params } = query.toSQL();
    return this.db.$client.executeSync(sqlString, params as any[])
      .rows[0] as Awaited<ReturnType<T['get']>>;
  }

  public allSync<T extends ExecutableSelect>(
    query: T,
  ): Awaited<ReturnType<T['all']>> {
    const { sql: sqlString, params } = query.toSQL();
    return this.db.$client.executeSync(sqlString, params as any[])
      .rows as Awaited<ReturnType<T['all']>>;
  }

  public async batch<T extends Record<string, unknown>>(
    data: T[],
    fn: (
      tx: TransactionParameter,
      ph: (arg: Extract<keyof T, string>) => Placeholder,
    ) => SQLitePreparedQuery<any>,
  ) {
    if (!data.length) {
      return;
    }

    const ph = (arg: Extract<keyof T, string>) => sql.placeholder(arg);
    const prepared = fn(this.db as unknown as TransactionParameter, ph);
    const query = prepared.getQuery();
    const params = data.map(item => {
      const values = fillPlaceholders(query.params, item);
      return values.map(value =>
        value === undefined ? null : (value as Scalar),
      ) as Scalar[];
    });
    const commands: SQLBatchTuple[] = [[query.sql, params]];

    await this.queue.enqueue({
      id: 'write',
      run: async () => {
        await this.db.$client.executeBatch(commands);
        this.db.$client?.flushPendingReactiveQueries();
      },
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
          this.db.$client?.flushPendingReactiveQueries();
          return result;
        }),
    });
  }
}

export const createDbManager = (dbInstance: DrizzleDb) => {
  return DbManager.create(dbInstance);
};

type TableNames = GetSelectTableName<Schema[keyof Schema]>;
type FireOn = { table: TableNames; ids?: number[] }[];

export function useLiveQuery<T extends ExecutableSelect>(
  query: T,
  fireOn: FireOn,
  callback?: (data: Awaited<ReturnType<T['all']>>) => void,
) {
  type ReturnValue = Awaited<ReturnType<T['all']>>;

  const { sql: sqlString, params } = query.toSQL();
  const paramsKey = JSON.stringify(params);
  const fireOnKey = JSON.stringify(fireOn);
  const cb = useRef(callback ?? (() => {}));

  const [data, setData] = useState<ReturnValue>(() => {
    const r = db.executeSync(sqlString, params as any[]).rows as ReturnValue;
    cb.current(r);
    return r;
  });

  useEffect(() => {
    const unsub = db.reactiveExecute({
      query: sqlString,
      arguments: params as any[],
      fireOn,
      callback: (result: { rows: ReturnValue }) => {
        setData(result.rows);
        cb.current(result.rows);
      },
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlString, paramsKey, fireOnKey]);

  return data;
}
