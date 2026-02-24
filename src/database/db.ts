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
import { useEffect, useReducer } from 'react';

class MyLogger implements Logger {
  logQuery(_query: string, _params: unknown[]): void {
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
  queries.forEach(query => executor.executeSync(query));
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
  createDbTriggers(executor);
  populateDatabase(executor);
};

type InitDbState = {
  success?: boolean;
  error?: Error;
};
const initialState = {
  success: false,
  error: undefined,
};
const fetchReducer = (
  state$1: InitDbState,
  action:
    | {
        type: 'migrating' | 'migrated';
        payload?: boolean | undefined;
      }
    | {
        type: 'error';
        payload: Error;
      },
) => {
  switch (action.type) {
    case 'migrating':
      return { ...initialState };
    case 'migrated':
      return {
        ...initialState,
        success: action.payload,
      };
    case 'error':
      return {
        ...initialState,
        error: action.payload,
      };
    default:
      return state$1;
  }
};

export const useInitDatabase = () => {
  const [state, dispatch] = useReducer(fetchReducer, initialState);
  useEffect(() => {
    dispatch({ type: 'migrating' });
    setPragmas(_db);
    migrate(drizzleDb, migrations)
      .then(() => {
        runDatabaseBootstrap(_db);
        dispatch({
          type: 'migrated',
          payload: true,
        });
      })
      .catch((error: Error) => {
        dispatch({
          type: 'error',
          payload: error,
        });
      });
  }, []);
  return state;
};
