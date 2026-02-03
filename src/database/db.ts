/* eslint-disable no-console */
import { drizzle } from 'drizzle-orm/op-sqlite';

import { schema } from './schema';
import { Logger } from 'drizzle-orm';

import { migrate } from 'drizzle-orm/op-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { createDbManager } from './manager/manager';
import { open } from '@op-engineering/op-sqlite';
import { createCategoryDefaultQuery } from './queryStrings/populate';
import {
  createCategoryTriggerQuery,
  createNovelTriggerQueryDelete,
  createNovelTriggerQueryInsert,
  createNovelTriggerQueryUpdate,
} from './queryStrings/triggers';
import { useRef, useState } from 'react';

class MyLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    //console.trace('DB Query: ', { query, params });
  }
}

const DB_NAME = 'lnreader.db';
const _db = open({ name: DB_NAME, location: '../files/SQLite' });

/**
 * Raw SQLite database instance
 * @deprecated Use `drizzleDb` for new code
 */
export const db = _db;

/**
 * Drizzle ORM database instance with type-safe query builder
 * Use this for all new database operations
 */
export const drizzleDb = drizzle(_db, {
  schema,
  logger: __DEV__ ? new MyLogger() : false,
});

export const dbManager = createDbManager(drizzleDb);

type SqlExecutor = {
  executeSync: (
    sql: string,
    params?: Parameters<typeof _db.executeSync>[1],
  ) => void;
};

const setPragmas = (executor: SqlExecutor) => {
  console.log('Setting database Pragmas');
  const queries = [
    'PRAGMA journal_mode = WAL',
    'PRAGMA synchronous = NORMAL',
    'PRAGMA temp_store = MEMORY',
    'PRAGMA busy_timeout = 5000',
    'PRAGMA cache_size = 10000',
    'PRAGMA foreign_keys = ON',
  ];
  executor.executeSync(queries.join(';\n'));
};
const populateDatabase = (executor: SqlExecutor) => {
  console.log('Populating database');
  executor.executeSync(createCategoryDefaultQuery);
};

const createDbTriggers = (executor: SqlExecutor) => {
  console.log('Creating database triggers');
  executor.executeSync(createCategoryTriggerQuery);
  executor.executeSync(createNovelTriggerQueryDelete);
  executor.executeSync(createNovelTriggerQueryInsert);
  executor.executeSync(createNovelTriggerQueryUpdate);
};

export const runDatabaseBootstrap = (executor: SqlExecutor) => {
  setPragmas(executor);
  createDbTriggers(executor);
  populateDatabase(executor);
};

type InitDbState = {
  success: boolean;
  error?: Error;
};

const initDatabase = async (): Promise<InitDbState> => {
  const res: InitDbState = { success: false, error: undefined };
  console.count('Using migrations');
  try {
    setPragmas(_db);

    await migrate(drizzleDb, migrations);

    createDbTriggers(_db);

    populateDatabase(_db);
    res.success = true;
  } catch (e) {
    console.error(e);
    res.error = e as Error;
  }

  return res;
};
export const useInitDatabase = () => {
  const started = useRef(false);
  const [res, setRes] = useState<InitDbState>({
    success: false,
    error: undefined,
  });
  if (started.current) return res;
  started.current = true;
  initDatabase().then(res => {
    setRes(res);
  });

  return res;
};

export const recreateDatabaseIndexes = () => {};
