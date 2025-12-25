import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { createCategoryDefaultQuery } from './tables/CategoryTable';
import {
  createNovelIndexQuery,
  dropNovelIndexQuery,
} from './tables/NovelTable';
import {
  createChapterIndexQuery,
  dropChapterIndexQuery,
} from './tables/ChapterTable';

import { getErrorMessage } from '@utils/error';
import { showToast } from '@utils/showToast';

import { schema } from './schema';
import { Logger } from 'drizzle-orm';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { createDbManager } from './manager/manager';

class MyLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    console.trace('DB Query: ', { query, params });
  }
}

const DB_NAME = 'lnreader.db';

/**
 * Raw SQLite database instance
 * @deprecated Use `drizzleDb` for new code
 */
export const db = SQLite.openDatabaseSync(DB_NAME);

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
  db.execSync(queries.join(';\n'));
};
const populateDatabase = () => {
  console.log('Populating database');
  db.runSync(createCategoryDefaultQuery);
};

export const useInitDatabase = () => {
  try {
    setPragmas();
  } catch (e) {
    console.log(e);
  }
  console.log('Using migrations');
  const returnValue = useMigrations(drizzleDb, migrations);

  try {
    populateDatabase();
  } catch (e) {
    console.log(e);
  }

  return returnValue;
};

export const recreateDatabaseIndexes = () => {
  try {
    db.execSync('PRAGMA analysis_limit=4000');
    db.execSync('PRAGMA optimize');

    db.execSync('PRAGMA journal_mode = WAL');
    db.execSync('PRAGMA foreign_keys = ON');
    db.execSync('PRAGMA synchronous = NORMAL');
    db.execSync('PRAGMA cache_size = 10000');
    db.execSync('PRAGMA temp_store = MEMORY');
    db.execSync('PRAGMA busy_timeout = 5000');

    db.withTransactionSync(() => {
      db.runSync(dropNovelIndexQuery);
      db.runSync(dropChapterIndexQuery);
      db.runSync(createNovelIndexQuery);
      db.runSync(createChapterIndexQuery);
    });
  } catch (error: unknown) {
    showToast(getErrorMessage(error));
  }
};
