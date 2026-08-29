import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from 'drizzle-orm/op-sqlite/migrator';
import migrations from '../../../drizzle/migrations';
import { schema } from '@database/schema';
import {
  createCategoryTriggerQuery,
  createNovelTriggerQueryDelete,
  createNovelTriggerQueryInsert,
  createNovelTriggerQueryUpdate,
} from '@database/queryStrings/triggers';

import {
  getPendingMigrations,
  repairChapterMigrationSnapshot,
  repairInterruptedNovelMigration,
  repairInterruptedNovelSnapshot,
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

// Pre-drizzle Chapter kept by `past_mandrill` via `IF NOT EXISTS`: it carries
// the FOREIGN KEY that makes the interrupted-migration copy-back fail.
const LEGACY_CHAPTER_TABLE_STATEMENT = `CREATE TABLE IF NOT EXISTS Chapter (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	novelId INTEGER NOT NULL,
	path TEXT NOT NULL,
	name TEXT NOT NULL,
	releaseTime TEXT,
	bookmark INTEGER DEFAULT 0,
	unread INTEGER DEFAULT 1,
	readTime TEXT,
	isDownloaded INTEGER DEFAULT 0,
	updatedTime TEXT,
	chapterNumber REAL NULL,
	page TEXT DEFAULT "1",
	position INTEGER DEFAULT 0,
	progress INTEGER,
	UNIQUE(path, novelId),
	FOREIGN KEY (novelId) REFERENCES Novel(id) ON DELETE CASCADE
)`;

const LEGACY_NOVEL_CATEGORY_TABLE_STATEMENT = `CREATE TABLE IF NOT EXISTS NovelCategory (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	novelId INTEGER NOT NULL,
	categoryId INTEGER NOT NULL,
	UNIQUE(novelId, categoryId),
	FOREIGN KEY (novelId) REFERENCES Novel(id) ON DELETE CASCADE,
	FOREIGN KEY (categoryId) REFERENCES Category(id) ON DELETE CASCADE
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

const createLegacySchema = (sqlite: DB) => {
  sqlite.executeSync(`CREATE TABLE IF NOT EXISTS Category (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	name text NOT NULL,
	sort integer
)`);
  sqlite.executeSync(
    'CREATE UNIQUE INDEX IF NOT EXISTS category_name_unique ON Category (name)',
  );
  sqlite.executeSync(
    'CREATE INDEX IF NOT EXISTS category_sort_idx ON Category (sort)',
  );
  sqlite.executeSync(LEGACY_NOVEL_TABLE_STATEMENT);
  sqlite.executeSync(
    'CREATE UNIQUE INDEX IF NOT EXISTS novel_path_plugin_unique ON Novel (path, pluginId)',
  );
  sqlite.executeSync(LEGACY_CHAPTER_TABLE_STATEMENT);
  sqlite.executeSync(
    'CREATE UNIQUE INDEX IF NOT EXISTS chapter_novel_path_unique ON Chapter (novelId, path)',
  );
  sqlite.executeSync(
    'CREATE INDEX IF NOT EXISTS chapterNovelIdIndex ON Chapter (novelId, position, page, id)',
  );
  sqlite.executeSync(LEGACY_NOVEL_CATEGORY_TABLE_STATEMENT);
  sqlite.executeSync(
    'CREATE UNIQUE INDEX IF NOT EXISTS novel_category_unique ON NovelCategory (novelId, categoryId)',
  );
  sqlite.executeSync(`CREATE TABLE IF NOT EXISTS Repository (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	url text NOT NULL
)`);
  sqlite.executeSync(
    'CREATE UNIQUE INDEX IF NOT EXISTS repository_url_unique ON Repository (url)',
  );
};

const recordAppliedMigrations = (sqlite: DB) => {
  sqlite.executeSync(`
    CREATE TABLE __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      hash text NOT NULL,
      created_at numeric,
      name text,
      applied_at text
    )
  `);
  const applied = [
    ['', 1766417172000, '20251222152612_past_mandrill'],
    ['', 1781306602000, '20260612232322_normal_saracen'],
    ['', 1784471667000, '20260719143427_long_moondragon'],
  ] as const;
  for (const [hash, createdAt, name] of applied) {
    sqlite.executeSync(
      `INSERT INTO __drizzle_migrations (hash, created_at, name, applied_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [hash, createdAt, name],
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
  it('rebuilds novel counters with one scan of the Chapter snapshot', () => {
    const sqlite = open({ name: ':memory:' });
    try {
      createSchema(sqlite);

      const statements = migrations.migrations['20260727081855_calm_chimera']
        .split('--> statement-breakpoint')
        .map((statement: string) => statement.trim())
        .filter(Boolean);
      const counterStatementIndex = statements.findIndex((statement: string) =>
        statement.startsWith('INSERT INTO `__new_Novel`'),
      );

      expect(counterStatementIndex).toBeGreaterThan(0);
      for (const statement of statements.slice(0, counterStatementIndex)) {
        sqlite.executeSync(statement);
      }

      const queryPlan = sqlite
        .executeRawSync(
          `EXPLAIN QUERY PLAN ${statements[counterStatementIndex]}`,
        )
        .map(row => String(row[3]));

      expect(
        queryPlan.filter(detail => detail.includes('SCAN __migration_Chapter')),
      ).toHaveLength(1);
      expect(queryPlan).not.toEqual(
        expect.arrayContaining([
          expect.stringContaining('CORRELATED SCALAR SUBQUERY'),
        ]),
      );
    } finally {
      sqlite.close();
    }
  });

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
      sqlite.executeSync(`
        INSERT INTO Repository (id, url)
        VALUES (1, 'https://example.com/plugins.min.json')
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
      expect(
        sqlite.executeSync('SELECT id, url, enabled FROM Repository').rows,
      ).toEqual([
        {
          id: 1,
          url: 'https://example.com/plugins.min.json',
          enabled: 1,
        },
      ]);
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
        '20260811071655_parched_human_torch',
        '20260829112818_mixed_nuke',
      ]);
    } finally {
      sqlite.close();
    }
  });

  const calmChimeraStatements = () =>
    migrations.migrations['20260727081855_calm_chimera']
      .split('--> statement-breakpoint')
      .map((statement: string) => statement.trim())
      .filter(Boolean);

  // Statements 0-3 drop triggers and snapshot Novel. An app killed after them
  // (before the Chapter snapshot statement) leaves `__migration_Novel` on disk
  // while `Novel` and `Chapter` stay live and keep accepting writes.
  const crashAfterNovelSnapshot = (sqlite: DB) => {
    for (const statement of calmChimeraStatements().slice(0, 4)) {
      sqlite.executeSync(statement);
    }
  };

  const runRecovery = async (sqlite: DB) => {
    repairInterruptedNovelMigration(sqlite);
    repairChapterMigrationSnapshot(sqlite);
    repairMigrationHistory(sqlite);
    repairInterruptedNovelSnapshot(sqlite);
    const drizzleDb = drizzle(sqlite, { schema });
    await migrate(drizzleDb, getPendingMigrations(sqlite));
  };

  it('recovers when novels were added while the migration was interrupted', async () => {
    const sqlite = open({ name: ':memory:' });
    sqlite.executeSync('PRAGMA foreign_keys = ON');
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createLegacySchema(sqlite);
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync('ALTER TABLE Chapter ADD timeSpent integer DEFAULT 0');
      for (const novelId of [1, 2]) {
        sqlite.executeSync(
          `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
           VALUES (${novelId}, '/novel-${novelId}', 'plugin-${novelId}', 'Novel ${novelId}', 1)`,
        );
        sqlite.executeSync(
          `INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded, readTime, updatedTime)
           VALUES (${
             (novelId - 1) * 3 + 1
           }, ${novelId}, '/novel-${novelId}/chapter-1', 'Chapter 1', 1, 1, '2026-07-26T10:00:00.000Z', '2026-07-26T11:00:00.000Z')`,
        );
      }
      sqlite.executeSync(
        `INSERT INTO Category (id, name, sort) VALUES (1, 'Default', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO NovelCategory (id, novelId, categoryId) VALUES (1, 1, 1)`,
      );
      recordAppliedMigrations(sqlite);

      crashAfterNovelSnapshot(sqlite);

      // The app kept running between attempts: a novel and its chapter are
      // added to the live tables after the Novel snapshot went stale.
      sqlite.executeSync(
        `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
         VALUES (3, '/novel-3', 'plugin-3', 'Novel 3', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded, readTime, updatedTime)
         VALUES (7, 3, '/novel-3/chapter-1', 'Chapter 3.1', 1, 0, '2026-07-27T10:00:00.000Z', '2026-07-27T11:00:00.000Z')`,
      );

      // Legacy Chapter still enforces `FOREIGN KEY (novelId) REFERENCES Novel`,
      // so the copy-back fails unless the Novel snapshot is backfilled first.
      await runRecovery(sqlite);

      expect(
        sqlite.executeSync('SELECT id, name FROM Novel ORDER BY id').rows,
      ).toEqual([
        { id: 1, name: 'Novel 1' },
        { id: 2, name: 'Novel 2' },
        { id: 3, name: 'Novel 3' },
      ]);
      expect(
        sqlite.executeSync('SELECT id, novelId, name FROM Chapter ORDER BY id')
          .rows,
      ).toEqual([
        { id: 1, novelId: 1, name: 'Chapter 1' },
        { id: 4, novelId: 2, name: 'Chapter 1' },
        { id: 7, novelId: 3, name: 'Chapter 3.1' },
      ]);
      expect(sqlite.executeRawSync('PRAGMA foreign_key_check;')).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('preserves novels added while the migration was interrupted (no legacy FK)', async () => {
    const sqlite = open({ name: ':memory:' });
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createSchema(sqlite);
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync('ALTER TABLE Chapter ADD timeSpent integer DEFAULT 0');
      for (const novelId of [1, 2]) {
        sqlite.executeSync(
          `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
           VALUES (${novelId}, '/novel-${novelId}', 'plugin-${novelId}', 'Novel ${novelId}', 1)`,
        );
        sqlite.executeSync(
          `INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded)
           VALUES (${
             (novelId - 1) * 3 + 1
           }, ${novelId}, '/novel-${novelId}/chapter-1', 'Chapter 1', 1, 1)`,
        );
      }
      recordAppliedMigrations(sqlite);

      crashAfterNovelSnapshot(sqlite);

      sqlite.executeSync(
        `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
         VALUES (3, '/novel-3', 'plugin-3', 'Novel 3', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded)
         VALUES (7, 3, '/novel-3/chapter-1', 'Chapter 3.1', 1, 0)`,
      );

      await runRecovery(sqlite);

      expect(
        sqlite.executeSync('SELECT id, name FROM Novel ORDER BY id').rows,
      ).toEqual([
        { id: 1, name: 'Novel 1' },
        { id: 2, name: 'Novel 2' },
        { id: 3, name: 'Novel 3' },
      ]);
      expect(
        sqlite.executeSync('SELECT id, novelId FROM Chapter ORDER BY id').rows,
      ).toEqual([
        { id: 1, novelId: 1 },
        { id: 4, novelId: 2 },
        { id: 7, novelId: 3 },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('recovers when NovelCategory rows were added while the migration was interrupted', async () => {
    const sqlite = open({ name: ':memory:' });
    sqlite.executeSync('PRAGMA foreign_keys = ON');
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createLegacySchema(sqlite);
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync('ALTER TABLE Chapter ADD timeSpent integer DEFAULT 0');
      for (const novelId of [1, 2]) {
        sqlite.executeSync(
          `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
           VALUES (${novelId}, '/novel-${novelId}', 'plugin-${novelId}', 'Novel ${novelId}', 1)`,
        );
      }
      sqlite.executeSync(
        `INSERT INTO Category (id, name, sort) VALUES (1, 'Default', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO NovelCategory (id, novelId, categoryId) VALUES (1, 1, 1)`,
      );
      recordAppliedMigrations(sqlite);

      crashAfterNovelSnapshot(sqlite);

      // Only the NovelCategory table gains a row for the new novel; the
      // Chapter snapshot stays consistent, so the Chapter copy-back succeeds
      // and the NovelCategory copy-back is the one that would violate the FK.
      sqlite.executeSync(
        `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
         VALUES (3, '/novel-3', 'plugin-3', 'Novel 3', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO NovelCategory (id, novelId, categoryId) VALUES (2, 3, 1)`,
      );

      await runRecovery(sqlite);

      expect(
        sqlite.executeSync('SELECT id, name FROM Novel ORDER BY id').rows,
      ).toEqual([
        { id: 1, name: 'Novel 1' },
        { id: 2, name: 'Novel 2' },
        { id: 3, name: 'Novel 3' },
      ]);
      expect(
        sqlite.executeSync(
          'SELECT novelId, categoryId FROM NovelCategory ORDER BY id',
        ).rows,
      ).toEqual([
        { novelId: 1, categoryId: 1 },
        { novelId: 3, categoryId: 1 },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('unsticks a device whose previous attempt already crashed the migration', async () => {
    const sqlite = open({ name: ':memory:' });
    sqlite.executeSync('PRAGMA foreign_keys = ON');
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createLegacySchema(sqlite);
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync('ALTER TABLE Chapter ADD timeSpent integer DEFAULT 0');
      for (const novelId of [1, 2]) {
        sqlite.executeSync(
          `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
           VALUES (${novelId}, '/novel-${novelId}', 'plugin-${novelId}', 'Novel ${novelId}', 1)`,
        );
        sqlite.executeSync(
          `INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded, readTime, updatedTime)
           VALUES (${
             (novelId - 1) * 3 + 1
           }, ${novelId}, '/novel-${novelId}/chapter-1', 'Chapter 1', 1, 1, '2026-07-26T10:00:00.000Z', '2026-07-26T11:00:00.000Z')`,
        );
      }
      sqlite.executeSync(
        `INSERT INTO Category (id, name, sort) VALUES (1, 'Default', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO NovelCategory (id, novelId, categoryId) VALUES (1, 1, 1)`,
      );
      recordAppliedMigrations(sqlite);

      crashAfterNovelSnapshot(sqlite);

      sqlite.executeSync(
        `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
         VALUES (3, '/novel-3', 'plugin-3', 'Novel 3', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded)
         VALUES (7, 3, '/novel-3/chapter-1', 'Chapter 3.1', 1, 0)`,
      );
      sqlite.executeSync(
        `INSERT INTO NovelCategory (id, novelId, categoryId) VALUES (2, 3, 1)`,
      );

      // A build without transactional migration runs the statements directly
      // and crashes at the Chapter copy-back, persisting the partial state.
      const statements = calmChimeraStatements();
      let crashError: unknown;
      let crashStatement: string | undefined;
      for (let index = 0; index < 14; index += 1) {
        try {
          sqlite.executeSync(statements[index]);
        } catch (error) {
          crashError = error;
          crashStatement = statements[index];
          break;
        }
      }
      expect(String(crashError)).toMatch(/FOREIGN KEY/i);
      expect(crashStatement).toContain('INSERT OR REPLACE INTO `Chapter`');
      expect(
        sqlite.executeSync('SELECT COUNT(*) AS count FROM Chapter').rows,
      ).toEqual([{ count: 0 }]);
      expect(
        sqlite.executeSync('SELECT id FROM Novel ORDER BY id').rows,
      ).toEqual([{ id: 1 }, { id: 2 }]);
      expect(
        sqlite.executeSync('SELECT COUNT(*) AS count FROM __migration_Chapter')
          .rows,
      ).toEqual([{ count: 3 }]);

      // Every later launch re-runs the migration and re-crashes: the app is
      // locked out until the repairs below unstick it.
      const lockedDrizzleDb = drizzle(sqlite, { schema });
      await expect(
        migrate(lockedDrizzleDb, getPendingMigrations(sqlite)),
      ).rejects.toThrow();

      await runRecovery(sqlite);

      expect(
        sqlite.executeSync('SELECT id, name FROM Novel ORDER BY id').rows,
      ).toEqual([
        { id: 1, name: 'Novel 1' },
        { id: 2, name: 'Novel 2' },
      ]);
      expect(
        sqlite.executeSync('SELECT id, novelId, name FROM Chapter ORDER BY id')
          .rows,
      ).toEqual([
        { id: 1, novelId: 1, name: 'Chapter 1' },
        { id: 4, novelId: 2, name: 'Chapter 1' },
      ]);
      expect(
        sqlite.executeSync(
          'SELECT novelId, categoryId FROM NovelCategory ORDER BY id',
        ).rows,
      ).toEqual([{ novelId: 1, categoryId: 1 }]);
      // The exact precondition of the production crash: no restored row may
      // reference a novel that the rebuilt `Novel` does not contain.
      expect(sqlite.executeRawSync('PRAGMA foreign_key_check;')).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('runs the full production initialization on a legacy database', async () => {
    const sqlite = open({ name: ':memory:' });
    sqlite.executeSync('PRAGMA foreign_keys = ON');
    (sqlite as any).executeAsync ??= sqlite.execute;
    (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
    try {
      createLegacySchema(sqlite);
      sqlite.executeSync('ALTER TABLE Chapter ADD scanlator text');
      sqlite.executeSync('ALTER TABLE Chapter ADD timeSpent integer DEFAULT 0');
      for (const novelId of [1, 2]) {
        sqlite.executeSync(
          `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
           VALUES (${novelId}, '/novel-${novelId}', 'plugin-${novelId}', 'Novel ${novelId}', 1)`,
        );
        sqlite.executeSync(
          `INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded, readTime, updatedTime)
           VALUES (${
             (novelId - 1) * 3 + 1
           }, ${novelId}, '/novel-${novelId}/chapter-1', 'Chapter 1', 1, 1, '2026-07-26T10:00:00.000Z', '2026-07-26T11:00:00.000Z')`,
        );
      }
      sqlite.executeSync(
        `INSERT INTO Category (id, name, sort) VALUES (1, 'Default', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO NovelCategory (id, novelId, categoryId) VALUES (1, 1, 1)`,
      );
      recordAppliedMigrations(sqlite);
      // A previous release's successful bootstrap left triggers behind.
      sqlite.executeSync(createNovelTriggerQueryInsert);
      sqlite.executeSync(createNovelTriggerQueryUpdate);
      sqlite.executeSync(createNovelTriggerQueryDelete);
      sqlite.executeSync(createCategoryTriggerQuery);

      crashAfterNovelSnapshot(sqlite);

      sqlite.executeSync(
        `INSERT INTO Novel (id, path, pluginId, name, inLibrary)
         VALUES (3, '/novel-3', 'plugin-3', 'Novel 3', 1)`,
      );
      sqlite.executeSync(
        `INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded)
         VALUES (7, 3, '/novel-3/chapter-1', 'Chapter 3.1', 1, 0)`,
      );
      sqlite.executeSync(
        `INSERT INTO NovelCategory (id, novelId, categoryId) VALUES (2, 3, 1)`,
      );

      // The exact production sequence: repairs, then migrate, then bootstrap.
      await runRecovery(sqlite);
      runDatabaseBootstrap(createExecutor(sqlite));

      expect(
        sqlite.executeSync('SELECT id, name FROM Novel ORDER BY id').rows,
      ).toEqual([
        { id: 1, name: 'Novel 1' },
        { id: 2, name: 'Novel 2' },
        { id: 3, name: 'Novel 3' },
      ]);
      expect(
        sqlite.executeSync('SELECT id, novelId FROM Chapter ORDER BY id').rows,
      ).toEqual([
        { id: 1, novelId: 1 },
        { id: 4, novelId: 2 },
        { id: 7, novelId: 3 },
      ]);
      expect(sqlite.executeRawSync('PRAGMA foreign_key_check;')).toEqual([]);
      const triggerNames = (
        sqlite.executeSync(
          "SELECT name FROM sqlite_master WHERE type = 'trigger'",
        ).rows as { name: string }[]
      ).map(row => row.name);
      expect(triggerNames).toEqual(
        expect.arrayContaining([
          'update_novel_stats',
          'update_novel_stats_on_update',
          'update_novel_stats_on_delete',
          'add_category',
        ]),
      );
      expect(
        sqlite.executeSync('SELECT id FROM Category ORDER BY id').rows,
      ).toEqual([{ id: 1 }, { id: 2 }]);
    } finally {
      sqlite.close();
    }
  });
});
