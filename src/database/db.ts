/* eslint-disable no-console */
import { drizzle } from 'drizzle-orm/op-sqlite';

import { getErrorMessage } from '@utils/error';
import { showToast } from '@utils/showToast';

import { categorySchema, schema } from './schema';
import { Logger } from 'drizzle-orm';

import { useMigrations } from 'drizzle-orm/op-sqlite/migrator';
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

class MyLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    //console.trace('DB Query: ', { query, params });
  }
}

const DB_NAME = 'lnreader.db';

/**
 * Raw SQLite database instance
 * @deprecated Use `drizzleDb` for new code
 */
//export const db = SQLite.openDatabaseSync(DB_NAME);
export const db = open({ name: DB_NAME });

/**
 * Drizzle ORM database instance with type-safe query builder
 * Use this for all new database operations
 */
export const drizzleDb = drizzle(db, {
  schema,
  logger: __DEV__ ? new MyLogger() : false,
});

export const dbManager = createDbManager(drizzleDb);

const setPragmas = () => {
  console.log('Setting database Pragmas');
  const queries = [
    'PRAGMA journal_mode = WAL',
    'PRAGMA synchronous = NORMAL',
    'PRAGMA temp_store = MEMORY',
    'PRAGMA busy_timeout = 5000',
    'PRAGMA cache_size = 10000',
    'PRAGMA foreign_keys = ON',
  ];
  db.executeSync(queries.join(';\n'));
};
const populateDatabase = () => {
  console.log('Populating database');
  db.executeSync(createCategoryDefaultQuery);
};

const createDbTriggers = () => {
  console.log('Creating database triggers');
  db.executeSync(createCategoryTriggerQuery);
  db.executeSync(createNovelTriggerQueryDelete);
  db.executeSync(createNovelTriggerQueryInsert);
  db.executeSync(createNovelTriggerQueryUpdate);
};

export const useInitDatabase = () => {
  try {
    setPragmas();
  } catch (e) {
    console.error(e);
  }
  console.log('Using migrations');
  const returnValue = useMigrations(drizzleDb, migrations);

  try {
    createDbTriggers();
  } catch (e) {
    console.error(e);
  }

  try {
    populateDatabase();
  } catch (e) {
    console.error(e);
  }
  setTimeout(async () => {
    const c = dbManager.select().from(categorySchema).prepare().all();
    console.log(await c);
  }, 1000);

  return returnValue;
};

export const recreateDatabaseIndexes = () => {};
