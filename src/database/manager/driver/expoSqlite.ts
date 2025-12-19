import { migrations } from '@database/migrations';
import { MigrationRunner } from '@database/utils/migrationRunner';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import type { SQLiteBindParams, SQLiteDatabase } from 'expo-sqlite';
import type { DriverFactory } from '../types';

export interface ExpoSqliteDriverOptions {
  dbName?: string;
  database?: SQLiteDatabase;
  applyPragmas?: boolean;
}

const DEFAULT_DB_NAME = 'lnreader.db';

const defaultPragmas = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA synchronous = NORMAL',
  'PRAGMA temp_store = MEMORY',
  'PRAGMA foreign_keys = ON',
  'PRAGMA cache_size = 10000',
  'PRAGMA busy_timeout = 5000',
];

function applyPragmas(db: SQLiteDatabase) {
  for (const pragma of defaultPragmas) {
    db.execSync(pragma);
  }
}

export const createExpoSqliteDriver: DriverFactory<ExpoSqliteDriverOptions> = (
  options = {},
) => {
  const sqlite =
    options.database ??
    SQLite.openDatabaseSync(options.dbName ?? DEFAULT_DB_NAME);

  if (options.applyPragmas !== false) {
    applyPragmas(sqlite);
  }

  const runner = new MigrationRunner(migrations);
  runner.runMigrations(sqlite);

  const db = drizzle(sqlite);

  return {
    db,
    raw: sqlite,
  };
};
