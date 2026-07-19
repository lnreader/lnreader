import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from 'drizzle-orm/op-sqlite/migrator';
import migrations from '../../../drizzle/migrations';
import { schema } from '@database/schema';

import {
  getPendingMigrations,
  repairMigrationHistory,
  runDatabaseBootstrap,
} from '@database/db';

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
	progress integer
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

const createExecutor = (sqlite: DB) => ({
  executeSync: (sql: string, params?: unknown[]) => {
    sqlite.executeSync(sql, params as any[]);
  },
});

describe('new database initialization', () => {
  it('creates schema, triggers, and default data', async () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      const drizzleDb = drizzle(sqlite, { schema });

      await migrate(drizzleDb, migrations);
      runDatabaseBootstrap(createExecutor(sqlite));

      const tables = sqlite.executeSync(
        "SELECT name FROM sqlite_master WHERE type='table'",
      ).rows as { name: string }[];
      const tableNames = tables.map(table => table.name);
      expect(tableNames).toEqual(
        expect.arrayContaining([
          'Category',
          'Chapter',
          'Novel',
          'NovelCategory',
          'Repository',
        ]),
      );

      const triggers = sqlite.executeSync(
        "SELECT name FROM sqlite_master WHERE type='trigger'",
      ).rows as { name: string }[];
      const triggerNames = triggers.map(trigger => trigger.name);
      expect(triggerNames).toEqual(
        expect.arrayContaining([
          'update_novel_stats',
          'update_novel_stats_on_update',
          'update_novel_stats_on_delete',
          'add_category',
        ]),
      );

      const categories = sqlite.executeSync(
        'SELECT id, name FROM Category ORDER BY id',
      ).rows as { id: number; name: string }[];
      expect(categories.map(category => category.id)).toEqual([1, 2]);
    } finally {
      sqlite.close();
    }
  });
});

describe('runDatabaseBootstrap', () => {
  it('applies pragmas, triggers, and default categories', () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      for (const statement of MIGRATION_STATEMENTS) {
        sqlite.executeSync(statement.trim());
      }

      sqlite.executeSync('PRAGMA journal_mode = WAL');
      runDatabaseBootstrap(createExecutor(sqlite));

      const journalMode = sqlite.executeRawSync('PRAGMA journal_mode')[0]?.[0];
      expect(['wal', 'memory']).toContain(String(journalMode).toLowerCase());

      const triggers = sqlite.executeSync(
        "SELECT name FROM sqlite_master WHERE type='trigger'",
      ).rows as { name: string }[];
      const triggerNames = triggers.map(trigger => trigger.name);
      expect(triggerNames).toEqual(
        expect.arrayContaining([
          'update_novel_stats',
          'update_novel_stats_on_update',
          'update_novel_stats_on_delete',
          'add_category',
        ]),
      );

      const categories = sqlite.executeSync(
        'SELECT id, name FROM Category ORDER BY id',
      ).rows as { id: number; name: string }[];
      expect(categories.map(category => category.id)).toEqual([1, 2]);
      expect(categories.map(category => category.name)).toEqual([
        'categories.default',
        'categories.local',
      ]);
    } finally {
      sqlite.close();
    }
  });
});

describe('production migrations', () => {
  it('can run after test schema exists', async () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      for (const statement of MIGRATION_STATEMENTS) {
        sqlite.executeSync(statement.trim());
      }

      const drizzleDb = drizzle(sqlite, { schema });
      await migrate(drizzleDb, getPendingMigrations(sqlite));

      const tables = sqlite.executeSync(
        "SELECT name FROM sqlite_master WHERE type='table'",
      ).rows as { name: string }[];
      const tableNames = tables.map(table => table.name);
      expect(tableNames).toEqual(
        expect.arrayContaining([
          'Category',
          'Chapter',
          'Novel',
          'NovelCategory',
          'Repository',
        ]),
      );
    } finally {
      sqlite.close();
    }
  });

  it('recovers when the scanlator column exists without a migration record', async () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      for (const statement of MIGRATION_STATEMENTS) {
        sqlite.executeSync(statement.trim());
      }
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync(`
        CREATE TABLE __drizzle_migrations (
          id INTEGER PRIMARY KEY,
          hash text NOT NULL,
          created_at numeric,
          name text,
          applied_at text
        )
      `);
      sqlite.executeSync(`
        INSERT INTO __drizzle_migrations (hash, created_at, name)
        VALUES ('', 1766417172000, NULL)
      `);

      repairMigrationHistory(sqlite);

      expect(
        sqlite.executeSync(
          "SELECT name FROM __drizzle_migrations WHERE name = '20260612232322_normal_saracen'",
        ).rows,
      ).toHaveLength(1);

      const drizzleDb = drizzle(sqlite, { schema });
      await migrate(drizzleDb, getPendingMigrations(sqlite));

      const scanlatorColumns = sqlite
        .executeRawSync('PRAGMA table_info(Chapter)')
        .filter(column => column[1] === 'scanlator');
      expect(scanlatorColumns).toHaveLength(1);

      const appliedMigrations = sqlite.executeSync(
        'SELECT name FROM __drizzle_migrations ORDER BY created_at',
      ).rows as Array<{ name: string }>;
      expect(appliedMigrations.map(row => row.name)).toEqual([
        '20251222152612_past_mandrill',
        '20260612232322_normal_saracen',
      ]);
    } finally {
      sqlite.close();
    }
  });
});
