/* eslint-disable no-console */
/**
 * Test database factory for creating in-memory SQLite databases
 * Uses op-sqlite Node runtime for Jest testing environment
 */

import { open } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { schema } from '@database/schema';
import {
  __resetDbManagerForTests,
  createDbManager,
} from '@database/manager/manager';
import {
  createCategoryTriggerQuery,
  createNovelTriggerQueryDelete,
  createNovelTriggerQueryInsert,
  createNovelTriggerQueryUpdate,
} from '@database/queryStrings/triggers';

// SQL migration from drizzle/0000_past_mandrill.sql
// SQLite uses double quotes or no quotes for identifiers, not backticks
const MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS Category (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	name text NOT NULL,
	sort integer
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS category_name_unique ON Category (name)`,
  `CREATE INDEX IF NOT EXISTS category_sort_idx ON Category (sort)`,
  `CREATE TABLE IF NOT EXISTS Chapter (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	novelId integer NOT NULL,
	path text NOT NULL,
	name text NOT NULL,
	releaseTime text,
	bookmark integer DEFAULT false,
	unread integer DEFAULT true,
	readTime text,
	isDownloaded integer DEFAULT false,
	updatedTime text,
	chapterNumber real,
	page text DEFAULT '1',
	position integer DEFAULT 0,
	progress integer,
	translatedContent text,
	translationLang text
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS chapter_novel_path_unique ON Chapter (novelId, path)`,
  `CREATE INDEX IF NOT EXISTS chapterNovelIdIndex ON Chapter (novelId, position, page, id)`,
  `CREATE TABLE IF NOT EXISTS Novel (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	path text NOT NULL,
	pluginId text NOT NULL,
	name text NOT NULL,
	cover text,
	summary text,
	author text,
	artist text,
	status text DEFAULT 'Unknown',
	genres text,
	inLibrary integer DEFAULT false,
	isLocal integer DEFAULT false,
	totalPages integer DEFAULT 0,
	chaptersDownloaded integer DEFAULT 0,
	chaptersUnread integer DEFAULT 0,
	totalChapters integer DEFAULT 0,
	lastReadAt text,
	lastUpdatedAt text
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS novel_path_plugin_unique ON Novel (path, pluginId)`,
  `CREATE INDEX IF NOT EXISTS NovelIndex ON Novel (pluginId, path, id, inLibrary)`,
  `CREATE TABLE IF NOT EXISTS NovelCategory (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	novelId integer NOT NULL,
	categoryId integer NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS novel_category_unique ON NovelCategory (novelId, categoryId)`,
  `CREATE TABLE IF NOT EXISTS Repository (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	url text NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS repository_url_unique ON Repository (url)`,
];

/**
 * Creates a fresh in-memory SQLite database with schema and migrations
 * @returns Database instance and dbManager
 */
export function createTestDb() {
  // Create in-memory database
  const sqlite = open({ name: ':memory:' });
  // drizzle-orm/op-sqlite expects executeAsync on the client
  (sqlite as any).executeAsync ??= sqlite.execute;
  (sqlite as any).executeRawAsync ??= sqlite.executeRaw;

  // Set pragmas for better performance and behavior
  sqlite.executeSync('PRAGMA journal_mode = WAL');
  sqlite.executeSync('PRAGMA synchronous = NORMAL');
  sqlite.executeSync('PRAGMA temp_store = MEMORY');
  sqlite.executeSync('PRAGMA busy_timeout = 5000');
  sqlite.executeSync('PRAGMA foreign_keys = ON');

  // Run migration SQL to create tables
  // Execute each statement separately
  for (const statement of MIGRATION_STATEMENTS) {
    try {
      sqlite.executeSync(statement.trim());
    } catch (error) {
      console.error('Migration error:', error);
      console.error('Failed statement:', statement);
      throw error;
    }
  }

  // Verify tables were created (for debugging)
  const tables = sqlite.executeSync(
    "SELECT name FROM sqlite_master WHERE type='table'",
  ).rows;
  const tableNames = tables
    .map((t: any) => t.name)
    .filter((n: string) => n !== 'sqlite_sequence');
  if (tableNames.length === 0) {
    throw new Error('No tables were created by migration');
  }
  // Verify Novel table exists
  if (!tableNames.includes('Novel')) {
    throw new Error(
      `Novel table not found. Created tables: ${tableNames.join(', ')}`,
    );
  }

  // Create Drizzle instance
  const drizzleDb = drizzle(sqlite, { schema });

  // Ensure singleton manager is bound to this test DB instance
  __resetDbManagerForTests();

  // Create triggers (same as production)
  sqlite.executeSync(createNovelTriggerQueryInsert);
  sqlite.executeSync(createNovelTriggerQueryUpdate);
  sqlite.executeSync(createNovelTriggerQueryDelete);
  sqlite.executeSync(createCategoryTriggerQuery);

  // Populate default categories
  sqlite.executeSync(`
    INSERT OR IGNORE INTO Category (id, name, sort) VALUES
      (1, 'Default', 1),
      (2, 'Local', 2)
  `);

  // Create test-compatible dbManager
  const dbManager = createDbManager(drizzleDb);

  return {
    sqlite,
    drizzleDb,
    dbManager,
  };
}

/**
 * Closes and cleans up a test database
 */
export function cleanupTestDb(testDb: ReturnType<typeof createTestDb>) {
  testDb.sqlite.close();
  __resetDbManagerForTests();
}

/**
 * Gets a dbManager instance for a test database
 * Convenience function for tests
 */
export function getTestDbManager(testDb: ReturnType<typeof createTestDb>) {
  return testDb.dbManager;
}

/**
 * Type export for test database
 */
export type TestDb = ReturnType<typeof createTestDb>;
