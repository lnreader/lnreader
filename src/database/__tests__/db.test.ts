import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from 'drizzle-orm/op-sqlite/migrator';
import migrations from '../../../drizzle/migrations';
import { schema } from '@database/schema';

jest.mock('@op-engineering/op-sqlite', () => ({
  __esModule: true,
  open: jest.fn(() => ({
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    executeAsync: jest.fn().mockResolvedValue({ rows: [] }),
    executeSync: jest.fn().mockReturnValue({ rows: [] }),
    executeRawAsync: jest.fn().mockResolvedValue([]),
    executeBatch: jest.fn().mockResolvedValue(undefined),
    flushPendingReactiveQueries: jest.fn(),
    reactiveExecute: jest.fn(() => () => undefined),
  })),
}));

import { runDatabaseBootstrap } from '@database/db';

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

const createExecutor = (sqlite: Database.Database) => ({
  executeSync: (sql: string, params?: unknown[]) => {
    if (params && params.length) {
      const stmt = sqlite.prepare(sql);
      stmt.run(params as any[]);
      return;
    }
    sqlite.exec(sql);
  },
});

const createOpSqliteAdapter = (sqlite: Database.Database) => {
  return {
    execute: async (sql: string, params?: unknown[]) => {
      const stmt = sqlite.prepare(sql);
      const rows =
        params && params.length ? stmt.all(params as any[]) : stmt.all();
      return {
        rows: {
          _array: rows.map(row =>
            Object.values(row as Record<string, unknown>),
          ),
        },
      };
    },
    executeSync: (sql: string, params?: unknown[]) => {
      const stmt = sqlite.prepare(sql);
      const result =
        params && params.length ? stmt.run(params as any[]) : stmt.run();
      return { rows: [], rowsAffected: result.changes ?? 0 };
    },
    executeAsync: async (sql: string, params?: unknown[]) => {
      const stmt = sqlite.prepare(sql);
      const result =
        params && params.length ? stmt.run(params as any[]) : stmt.run();
      return { rows: [], rowsAffected: result.changes ?? 0 };
    },
    executeRawAsync: async (sql: string, params?: unknown[]) => {
      const stmt = sqlite.prepare(sql).raw();
      const rows =
        params && params.length ? stmt.all(params as any[]) : stmt.all();
      return rows as unknown[][];
    },
    executeBatch: async (
      commands: Array<[string, unknown[] | unknown[][]]>,
    ) => {
      const transaction = sqlite.transaction((cmds: typeof commands) => {
        for (const cmd of cmds) {
          const stmt = sqlite.prepare(cmd[0]);
          if (Array.isArray(cmd[1])) {
            for (const arg of cmd[1]) {
              stmt.run(arg as any[]);
            }
          } else {
            stmt.run(cmd[1] as any[]);
          }
        }
      });
      transaction(commands);
    },
    flushPendingReactiveQueries: () => undefined,
    reactiveExecute: () => () => undefined,
  };
};

describe('new database initialization', () => {
  it('creates schema, triggers, and default data', async () => {
    const sqlite = new Database(':memory:');
    try {
      const adapter = createOpSqliteAdapter(sqlite);
      const drizzleDb = drizzle(adapter, { schema });

      await migrate(drizzleDb, migrations);
      runDatabaseBootstrap(createExecutor(sqlite));

      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>;
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

      const triggers = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='trigger'")
        .all() as Array<{ name: string }>;
      const triggerNames = triggers.map(trigger => trigger.name);
      expect(triggerNames).toEqual(
        expect.arrayContaining([
          'update_novel_stats',
          'update_novel_stats_on_update',
          'update_novel_stats_on_delete',
          'add_category',
        ]),
      );

      const categories = sqlite
        .prepare('SELECT id, name FROM Category ORDER BY id')
        .all() as Array<{ id: number; name: string }>;
      expect(categories.map(category => category.id)).toEqual([1, 2]);
    } finally {
      sqlite.close();
    }
  });
});

describe('runDatabaseBootstrap', () => {
  it('applies pragmas, triggers, and default categories', () => {
    const sqlite = new Database(':memory:');
    try {
      for (const statement of MIGRATION_STATEMENTS) {
        sqlite.exec(statement.trim());
      }

      runDatabaseBootstrap(createExecutor(sqlite));

      const journalMode = sqlite.pragma('journal_mode', { simple: true });
      expect(['wal', 'memory']).toContain(String(journalMode).toLowerCase());

      const triggers = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='trigger'")
        .all() as Array<{ name: string }>;
      const triggerNames = triggers.map(trigger => trigger.name);
      expect(triggerNames).toEqual(
        expect.arrayContaining([
          'update_novel_stats',
          'update_novel_stats_on_update',
          'update_novel_stats_on_delete',
          'add_category',
        ]),
      );

      const categories = sqlite
        .prepare('SELECT id, name FROM Category ORDER BY id')
        .all() as Array<{ id: number; name: string }>;
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
    const sqlite = new Database(':memory:');
    try {
      for (const statement of MIGRATION_STATEMENTS) {
        sqlite.exec(statement.trim());
      }

      const adapter = createOpSqliteAdapter(sqlite);
      const drizzleDb = drizzle(adapter, { schema });
      await migrate(drizzleDb, migrations);

      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>;
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
});
