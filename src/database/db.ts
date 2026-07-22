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

const INITIAL_MIGRATION_NAME = '20251222152612_past_mandrill';
const INITIAL_MIGRATION_CREATED_AT = 1766417172000;
const SCANLATOR_MIGRATION_NAME = '20260612232322_normal_saracen';
const SCANLATOR_MIGRATION_CREATED_AT = 1781306602000;

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

type MigrationExecutor = {
  executeRawSync: (sql: string) => unknown[][];
  executeSync: (sql: string) => unknown;
};

/**
 * Repairs migration metadata created by older Drizzle versions and interrupted
 * migrations. SQLite cannot add a column conditionally, so an existing column
 * must be recorded before the migrator attempts to add it again.
 */
export const repairMigrationHistory = (executor: MigrationExecutor) => {
  const migrationColumns = executor.executeRawSync(
    'PRAGMA table_info(__drizzle_migrations);',
  );

  if (migrationColumns.length === 0) {
    return;
  }

  const columnNames = new Set(migrationColumns.map(row => row[1]));
  if (!columnNames.has('name')) {
    executor.executeSync(
      "ALTER TABLE '__drizzle_migrations' ADD COLUMN 'name' text;",
    );
  }
  if (!columnNames.has('applied_at')) {
    executor.executeSync(
      "ALTER TABLE '__drizzle_migrations' ADD COLUMN 'applied_at' text;",
    );
  }

  executor.executeSync(`
    UPDATE __drizzle_migrations
    SET name = '${INITIAL_MIGRATION_NAME}'
    WHERE name IS NULL
      AND created_at = ${INITIAL_MIGRATION_CREATED_AT};
  `);

  const chapterColumns = executor.executeRawSync('PRAGMA table_info(Chapter);');
  const hasScanlator = chapterColumns.some(row => row[1] === 'scanlator');

  if (hasScanlator) {
    executor.executeSync(`
      INSERT INTO __drizzle_migrations
        (hash, created_at, name, applied_at)
      SELECT '', ${SCANLATOR_MIGRATION_CREATED_AT},
        '${SCANLATOR_MIGRATION_NAME}', datetime('now')
      WHERE NOT EXISTS (
        SELECT 1 FROM __drizzle_migrations
        WHERE name = '${SCANLATOR_MIGRATION_NAME}'
      );
    `);
  }
};

/**
 * Drizzle beta 20 does not currently read op-sqlite's array-shaped query
 * results when deciding which migrations are pending. Filter them explicitly
 * until the driver handles the current op-sqlite result shape.
 */
export const getPendingMigrations = (executor: MigrationExecutor) => {
  const migrationColumns = executor.executeRawSync(
    'PRAGMA table_info(__drizzle_migrations);',
  );

  if (migrationColumns.length === 0) {
    return migrations;
  }

  const appliedMigrations = new Set(
    executor
      .executeRawSync(
        'SELECT name FROM __drizzle_migrations WHERE name IS NOT NULL;',
      )
      .map(row => row[0]),
  );

  return {
    migrations: Object.fromEntries(
      Object.entries(migrations.migrations).filter(
        ([name]) => !appliedMigrations.has(name),
      ),
    ),
  };
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
  executor.executeSync('DROP TRIGGER IF EXISTS update_novel_stats');
  executor.executeSync('DROP TRIGGER IF EXISTS update_novel_stats_on_update');
  executor.executeSync('DROP TRIGGER IF EXISTS update_novel_stats_on_delete');
  executor.executeSync('DROP TRIGGER IF EXISTS add_category');
  executor.executeSync(createCategoryTriggerQuery);
  executor.executeSync(createNovelTriggerQueryDelete);
  executor.executeSync(createNovelTriggerQueryInsert);
  executor.executeSync(createNovelTriggerQueryUpdate);
};

export const runDatabaseBootstrap = (executor: SqlExecutor) => {
  createDbTriggers(executor);
  populateDatabase(executor);
};

let initialization: Promise<void> | undefined;

export const initializeDatabase = () => {
  if (!initialization) {
    setPragmas(_db);
    repairMigrationHistory(_db);
    initialization = migrate(drizzleDb, getPendingMigrations(_db)).then(() => {
      runDatabaseBootstrap(_db);
    });
  }
  return initialization;
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
    initializeDatabase()
      .then(() => {
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
