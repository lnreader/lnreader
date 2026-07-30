import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from 'drizzle-orm/op-sqlite/migrator';
import migrations from '../../../drizzle/migrations';
import { schema } from '@database/schema';

import {
  getPendingMigrations,
  repairChapterMigrationSnapshot,
  repairInterruptedNovelMigration,
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

const LEGACY_NOVEL_TABLE_STATEMENT = `CREATE TABLE IF NOT EXISTS Novel (
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
	totalPages integer DEFAULT 0
)`;

const createSchema = (sqlite: DB, legacyNovel = false) => {
  for (const statement of MIGRATION_STATEMENTS) {
    sqlite.executeSync(
      legacyNovel && statement.startsWith('CREATE TABLE IF NOT EXISTS Novel (')
        ? LEGACY_NOVEL_TABLE_STATEMENT
        : statement.trim(),
    );
  }
};

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
      createSchema(sqlite);

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
      createSchema(sqlite);

      sqlite.executeSync(`
        INSERT INTO Category (id, name, sort)
        VALUES (1, 'Existing category', 1)
      `);
      sqlite.executeSync(`
        INSERT INTO Novel (id, path, pluginId, name, inLibrary)
        VALUES (1, '/existing', 'existing-plugin', 'Existing novel', 1)
      `);
      sqlite.executeSync(`
        INSERT INTO Chapter (
          id,
          novelId,
          path,
          name,
          unread,
          isDownloaded,
          readTime,
          updatedTime
        )
        VALUES (
          1,
          1,
          '/existing/chapter-1',
          'Existing chapter',
          1,
          1,
          '2026-07-26T10:00:00.000Z',
          '2026-07-26T11:00:00.000Z'
        )
      `);
      sqlite.executeSync(`
        INSERT INTO NovelCategory (id, novelId, categoryId)
        VALUES (1, 1, 1)
      `);

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

      expect(
        sqlite.executeSync(
          'SELECT id, name, chaptersDownloaded, chaptersUnread, totalChapters FROM Novel',
        ).rows,
      ).toEqual([
        {
          id: 1,
          name: 'Existing novel',
          chaptersDownloaded: 1,
          chaptersUnread: 1,
          totalChapters: 1,
        },
      ]);
      expect(
        sqlite.executeSync('SELECT id, novelId, name FROM Chapter').rows,
      ).toEqual([{ id: 1, novelId: 1, name: 'Existing chapter' }]);
      expect(
        sqlite.executeSync('SELECT id, novelId, categoryId FROM NovelCategory')
          .rows,
      ).toEqual([{ id: 1, novelId: 1, categoryId: 1 }]);
    } finally {
      sqlite.close();
    }
  });

  it('repairs a legacy Novel table that is missing counter columns', async () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createSchema(sqlite, true);
      sqlite.executeSync(`
        INSERT INTO Category (id, name, sort)
        VALUES (1, 'Existing category', 1)
      `);
      sqlite.executeSync(`
        INSERT INTO Novel (id, path, pluginId, name, inLibrary)
        VALUES (1, '/legacy', 'legacy-plugin', 'Legacy novel', 1)
      `);
      sqlite.executeSync(`
        INSERT INTO Chapter (
          id,
          novelId,
          path,
          name,
          unread,
          isDownloaded,
          readTime,
          updatedTime
        )
        VALUES
          (
            1,
            1,
            '/legacy/chapter-1',
            'Chapter 1',
            0,
            1,
            '2026-07-25T10:00:00.000Z',
            '2026-07-25T11:00:00.000Z'
          ),
          (
            2,
            1,
            '/legacy/chapter-2',
            'Chapter 2',
            1,
            0,
            NULL,
            '2026-07-26T11:00:00.000Z'
          )
      `);
      sqlite.executeSync(`
        INSERT INTO NovelCategory (id, novelId, categoryId)
        VALUES (1, 1, 1)
      `);

      const drizzleDb = drizzle(sqlite, { schema });
      await migrate(drizzleDb, getPendingMigrations(sqlite));

      expect(
        sqlite.executeSync(
          `SELECT
            id,
            chaptersDownloaded,
            chaptersUnread,
            totalChapters,
            lastReadAt,
            lastUpdatedAt
          FROM Novel`,
        ).rows,
      ).toEqual([
        {
          id: 1,
          chaptersDownloaded: 1,
          chaptersUnread: 1,
          totalChapters: 2,
          lastReadAt: '2026-07-25T10:00:00.000Z',
          lastUpdatedAt: '2026-07-26T11:00:00.000Z',
        },
      ]);
      expect(
        sqlite.executeSync('SELECT id FROM Chapter ORDER BY id').rows,
      ).toEqual([{ id: 1 }, { id: 2 }]);
      expect(
        sqlite.executeSync('SELECT novelId, categoryId FROM NovelCategory')
          .rows,
      ).toEqual([{ novelId: 1, categoryId: 1 }]);
    } finally {
      sqlite.close();
    }
  });

  it('resumes after Novel was dropped during the previous repair migration', async () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createSchema(sqlite);
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync('ALTER TABLE Chapter ADD timeSpent integer DEFAULT 0');
      sqlite.executeSync(`
        INSERT INTO Category (id, name, sort)
        VALUES (1, 'Existing category', 1)
      `);
      sqlite.executeSync(`
        INSERT INTO Novel (id, path, pluginId, name, inLibrary)
        VALUES (1, '/interrupted', 'legacy-plugin', 'Interrupted novel', 1)
      `);
      sqlite.executeSync(`
        INSERT INTO Chapter (
          id,
          novelId,
          path,
          name,
          unread,
          isDownloaded,
          scanlator,
          timeSpent
        )
        VALUES (
          1,
          1,
          '/interrupted/chapter-1',
          'Chapter 1',
          1,
          1,
          'Group',
          12
        )
      `);
      sqlite.executeSync(`
        INSERT INTO NovelCategory (id, novelId, categoryId)
        VALUES (1, 1, 1)
      `);

      sqlite.executeSync('CREATE TABLE __new_Novel AS SELECT * FROM Novel');
      sqlite.executeSync(
        'CREATE TABLE __migration_Chapter AS SELECT * FROM Chapter',
      );
      sqlite.executeSync(
        'CREATE TABLE __migration_NovelCategory AS SELECT * FROM NovelCategory',
      );
      sqlite.executeSync('DELETE FROM NovelCategory');
      sqlite.executeSync('DELETE FROM Chapter');
      sqlite.executeSync('DROP TABLE Novel');

      repairInterruptedNovelMigration(sqlite);
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

      const drizzleDb = drizzle(sqlite, { schema });
      await migrate(drizzleDb, getPendingMigrations(sqlite));

      expect(
        sqlite.executeSync(
          'SELECT id, name, chaptersDownloaded, chaptersUnread, totalChapters FROM Novel',
        ).rows,
      ).toEqual([
        {
          id: 1,
          name: 'Interrupted novel',
          chaptersDownloaded: 1,
          chaptersUnread: 1,
          totalChapters: 1,
        },
      ]);
      expect(
        sqlite.executeSync('SELECT id, scanlator, timeSpent FROM Chapter').rows,
      ).toEqual([{ id: 1, scanlator: 'Group', timeSpent: 12 }]);
      expect(
        sqlite.executeSync('SELECT novelId, categoryId FROM NovelCategory')
          .rows,
      ).toEqual([{ novelId: 1, categoryId: 1 }]);
    } finally {
      sqlite.close();
    }
  });

  it('repairs an interrupted Chapter snapshot missing recent columns', async () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createSchema(sqlite);
      sqlite.executeSync(`
        INSERT INTO Category (id, name, sort)
        VALUES (1, 'Existing category', 1)
      `);
      sqlite.executeSync(`
        INSERT INTO Novel (id, path, pluginId, name, inLibrary)
        VALUES (1, '/interrupted', 'legacy-plugin', 'Interrupted novel', 1)
      `);
      sqlite.executeSync(`
        INSERT INTO Chapter (
          id,
          novelId,
          path,
          name,
          unread,
          isDownloaded
        )
        VALUES (
          1,
          1,
          '/interrupted/chapter-1',
          'Chapter 1',
          1,
          1
        )
      `);
      sqlite.executeSync(`
        INSERT INTO NovelCategory (id, novelId, categoryId)
        VALUES (1, 1, 1)
      `);

      sqlite.executeSync(
        'CREATE TABLE __migration_Chapter AS SELECT * FROM Chapter',
      );
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync('ALTER TABLE Chapter ADD timeSpent integer DEFAULT 0');
      sqlite.executeSync(
        'CREATE TABLE __migration_Novel AS SELECT * FROM Novel',
      );
      sqlite.executeSync(
        'CREATE TABLE __migration_NovelCategory AS SELECT * FROM NovelCategory',
      );
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

      repairChapterMigrationSnapshot(sqlite);
      repairMigrationHistory(sqlite);

      const snapshotColumns = sqlite
        .executeRawSync('PRAGMA table_info(__migration_Chapter)')
        .map(column => column[1]);
      expect(snapshotColumns).toEqual(
        expect.arrayContaining(['scanlator', 'timeSpent']),
      );

      const drizzleDb = drizzle(sqlite, { schema });
      await migrate(drizzleDb, getPendingMigrations(sqlite));

      expect(
        sqlite.executeSync('SELECT id, name, scanlator, timeSpent FROM Chapter')
          .rows,
      ).toEqual([
        {
          id: 1,
          name: 'Chapter 1',
          scanlator: null,
          timeSpent: 0,
        },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('preserves snapshot columns while adding a missing timeSpent column', () => {
    const sqlite = open({ name: ':memory:' });
    try {
      createSchema(sqlite);
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync(`
        INSERT INTO Novel (id, path, pluginId, name)
        VALUES (1, '/snapshot', 'legacy-plugin', 'Snapshot novel')
      `);
      sqlite.executeSync(`
        INSERT INTO Chapter (id, novelId, path, name, scanlator)
        VALUES (1, 1, '/snapshot/chapter-1', 'Chapter 1', 'Group')
      `);
      sqlite.executeSync(
        'CREATE TABLE __migration_Chapter AS SELECT * FROM Chapter',
      );

      repairChapterMigrationSnapshot(sqlite);

      expect(
        sqlite.executeSync(
          'SELECT id, scanlator, timeSpent FROM __migration_Chapter',
        ).rows,
      ).toEqual([{ id: 1, scanlator: 'Group', timeSpent: 0 }]);
    } finally {
      sqlite.close();
    }
  });

  it('recovers when Chapter columns exist without migration records', async () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createSchema(sqlite);
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync('ALTER TABLE Chapter ADD timeSpent integer DEFAULT 0');
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
      expect(
        sqlite.executeSync(
          "SELECT name FROM __drizzle_migrations WHERE name = '20260719143427_long_moondragon'",
        ).rows,
      ).toHaveLength(1);

      const drizzleDb = drizzle(sqlite, { schema });
      await migrate(drizzleDb, getPendingMigrations(sqlite));

      const scanlatorColumns = sqlite
        .executeRawSync('PRAGMA table_info(Chapter)')
        .filter(column => column[1] === 'scanlator');
      expect(scanlatorColumns).toHaveLength(1);
      const timeSpentColumns = sqlite
        .executeRawSync('PRAGMA table_info(Chapter)')
        .filter(column => column[1] === 'timeSpent');
      expect(timeSpentColumns).toHaveLength(1);

      const appliedMigrations = sqlite.executeSync(
        'SELECT name FROM __drizzle_migrations ORDER BY created_at',
      ).rows as { name: string }[];
      expect(appliedMigrations.map(row => row.name)).toEqual([
        '20251222152612_past_mandrill',
        '20260612232322_normal_saracen',
        '20260719143427_long_moondragon',
        '20260727081855_calm_chimera',
      ]);
    } finally {
      sqlite.close();
    }
  });
});
