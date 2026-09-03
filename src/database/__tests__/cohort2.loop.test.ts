// Regression test for the #1754 cohort-2 upgrade path.
//
// Builds a faithful v2.0.3 production database in the exact state issue #1754
// reports: the v2.0.3 schema (counter columns exist), chapters that predate
// the counter triggers (so counters were never maintained and sit at their
// DEFAULT 0), PRAGMA user_version = 2, and no __drizzle_migrations table.
// Then runs the exact master initializeDatabase sequence and asserts the
// badge data the UI reads (chaptersUnread/chaptersDownloaded per inLibrary
// novel).
//
// Table shapes and triggers are copied verbatim from the v2.0.3 tag
// (src/database/tables/*Table.ts), not from the current schema, so the full
// five-migration chain runs against the real legacy starting shape.
//
// `location: ':memory:'` — op-sqlite's Node runtime only honors the
// in-memory special value in the location slot.

import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from 'drizzle-orm/op-sqlite/migrator';
import migrationsRegistry from '../../../drizzle/migrations';
import { schema } from '@database/schema';
import {
  getPendingMigrations,
  repairChapterMigrationSnapshot,
  repairInterruptedNovelMigration,
  repairInterruptedNovelSnapshot,
  repairMigrationHistory,
  runDatabaseBootstrap,
} from '@database/db';

// v2.0.3 src/database/tables/NovelTable.ts — counter columns already present.
const V203_NOVEL_TABLE = `CREATE TABLE IF NOT EXISTS Novel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    pluginId TEXT NOT NULL,
    name TEXT NOT NULL,
    cover TEXT,
    summary TEXT,
    author TEXT,
    artist TEXT,
    status TEXT Default 'Unknown',
    genres TEXT,
    inLibrary INTEGER DEFAULT 0,
    isLocal INTEGER DEFAULT 0,
    totalPages INTEGER DEFAULT 0,
    chaptersDownloaded INTEGER DEFAULT 0,
    chaptersUnread INTEGER DEFAULT 0,
    totalChapters INTEGER DEFAULT 0,
    lastReadAt TEXT,
    lastUpdatedAt TEXT,
    UNIQUE(path, pluginId)
)`;

// v2.0.3 src/database/tables/ChapterTable.ts — no scanlator/timeSpent yet,
// carries the FOREIGN KEY + inline UNIQUE.
const V203_CHAPTER_TABLE = `CREATE TABLE IF NOT EXISTS Chapter (
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

const V203_NOVEL_CATEGORY_TABLE = `CREATE TABLE IF NOT EXISTS NovelCategory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novelId INTEGER NOT NULL,
    categoryId INTEGER NOT NULL,
    UNIQUE(novelId, categoryId),
    FOREIGN KEY (novelId) REFERENCES Novel(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES Category(id) ON DELETE CASCADE
)`;

// v2.0.3 src/database/tables/NovelTable.ts triggers, same names as master's.
const V203_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS update_novel_stats
AFTER INSERT ON Chapter
BEGIN
    UPDATE Novel
    SET
        totalChapters = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id),
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = NEW.novelId;
END;`,
  `CREATE TRIGGER IF NOT EXISTS update_novel_stats_on_update
AFTER UPDATE ON Chapter
BEGIN
    UPDATE Novel
    SET
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        lastReadAt = (SELECT MAX(readTime) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = NEW.novelId;
END;`,
  `CREATE TRIGGER IF NOT EXISTS update_novel_stats_on_delete
AFTER DELETE ON Chapter
BEGIN
    UPDATE Novel
    SET
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        totalChapters = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastReadAt = (SELECT MAX(readTime) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = OLD.novelId;
END;`,
];

const openV203Database = () => {
  const sqlite = open({ name: 'cohort2-loop.db', location: ':memory:' });
  (sqlite as any).executeAsync ??= sqlite.execute;
  (sqlite as any).executeRawAsync ??= sqlite.executeRaw;
  sqlite.executeSync(`CREATE TABLE IF NOT EXISTS Category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort INTEGER
)`);
  sqlite.executeSync(V203_NOVEL_TABLE);
  sqlite.executeSync(
    'CREATE INDEX IF NOT EXISTS NovelIndex ON Novel(pluginId, path, id, inLibrary)',
  );
  sqlite.executeSync(V203_CHAPTER_TABLE);
  sqlite.executeSync(
    'CREATE INDEX IF NOT EXISTS chapterNovelIdIndex ON Chapter(novelId, position,page, id)',
  );
  sqlite.executeSync(V203_NOVEL_CATEGORY_TABLE);
  sqlite.executeSync(`CREATE TABLE IF NOT EXISTS Repository (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL
)`);

  // Library data as #1754 reports it: real novels and chapters, novel badges
  // dark because the counter columns were never populated.
  sqlite.executeSync(
    `INSERT INTO Category (id, name, sort) VALUES (1, 'Default', 1)`,
  );
  sqlite.executeSync(`INSERT INTO Novel (id, path, pluginId, name, inLibrary)
    VALUES (1, '/novel-1', 'plugin-1', 'Novel 1', 1)`);
  sqlite.executeSync(`INSERT INTO Novel (id, path, pluginId, name, inLibrary)
    VALUES (2, '/novel-2', 'plugin-2', 'Novel 2', 1)`);
  sqlite.executeSync(`INSERT INTO Novel (id, path, pluginId, name, inLibrary)
    VALUES (3, '/novel-3', 'plugin-3', 'Novel 3', 1)`);
  sqlite.executeSync(`INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded, readTime, updatedTime)
    VALUES (1, 1, '/novel-1/chapter-1', 'Chapter 1', 0, 1, '2026-07-25T10:00:00.000Z', '2026-07-25T11:00:00.000Z')`);
  sqlite.executeSync(`INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded, readTime, updatedTime)
    VALUES (2, 1, '/novel-1/chapter-2', 'Chapter 2', 1, 1, NULL, '2026-07-26T11:00:00.000Z')`);
  sqlite.executeSync(`INSERT INTO Chapter (id, novelId, path, name, unread, isDownloaded, readTime, updatedTime)
    VALUES (3, 2, '/novel-2/chapter-1', 'Chapter 1', 1, 0, '2026-07-24T09:00:00.000Z', '2026-07-24T10:00:00.000Z')`);
  sqlite.executeSync(
    `INSERT INTO NovelCategory (id, novelId, categoryId) VALUES (1, 1, 1)`,
  );

  // v2.0.3 bootstrap created these AFTER the data already existed, so they
  // never backfilled the counters — the exact cohort-2 mechanism.
  // Minimisation outcome: neither the triggers nor the user_version stamp is
  // load-bearing for the red/green verdicts — the load-bearing elements are
  // the v2.0.3 table shapes, counters left at 0, chapters present, and the
  // absence of a __drizzle_migrations table. They are kept because they are
  // what real cohort-2 databases contain.
  for (const trigger of V203_TRIGGERS) {
    sqlite.executeSync(trigger);
  }
  sqlite.executeSync('PRAGMA user_version = 2');
  return sqlite;
};

type MigrationsConfig = Parameters<typeof migrate>[1];

const runProductionUpgrade = async (
  sqlite: DB,
  migrationsConfig?: MigrationsConfig,
) => {
  sqlite.executeSync('PRAGMA foreign_keys = ON');
  repairInterruptedNovelMigration(sqlite);
  repairInterruptedNovelSnapshot(sqlite);
  repairChapterMigrationSnapshot(sqlite);
  repairMigrationHistory(sqlite);
  const drizzleDb = drizzle(sqlite, { schema });
  await migrate(drizzleDb, migrationsConfig ?? getPendingMigrations(sqlite));
  runDatabaseBootstrap({
    executeSync: (sql: string, params?: unknown[]) =>
      sqlite.executeSync(sql, params as any[]),
  });
};

const badgeRows = (sqlite: DB) =>
  sqlite.executeSync(
    `SELECT id, chaptersDownloaded, chaptersUnread, totalChapters, lastReadAt, lastUpdatedAt
     FROM Novel ORDER BY id`,
  ).rows;

describe('v2.0.3 cohort-2 upgrade (#1754)', () => {
  it('keeps every counter at 0 when the repair migration is absent (v2.1.0)', async () => {
    const sqlite = openV203Database();
    try {
      // Emulate v2.1.0, which shipped without calm_chimera.
      const v210Migrations = Object.fromEntries(
        Object.entries(migrationsRegistry.migrations).filter(
          ([name]) =>
            !name.includes('calm_chimera') &&
            !name.includes('parched_human_torch'),
        ),
      );
      await runProductionUpgrade(sqlite, { migrations: v210Migrations });

      expect(badgeRows(sqlite)).toEqual([
        {
          id: 1,
          chaptersDownloaded: 0,
          chaptersUnread: 0,
          totalChapters: 0,
          lastReadAt: null,
          lastUpdatedAt: null,
        },
        {
          id: 2,
          chaptersDownloaded: 0,
          chaptersUnread: 0,
          totalChapters: 0,
          lastReadAt: null,
          lastUpdatedAt: null,
        },
        {
          id: 3,
          chaptersDownloaded: 0,
          chaptersUnread: 0,
          totalChapters: 0,
          lastReadAt: null,
          lastUpdatedAt: null,
        },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('repairs the faithful v2.0.3 database on current master', async () => {
    const sqlite = openV203Database();
    try {
      await runProductionUpgrade(sqlite);

      expect(badgeRows(sqlite)).toEqual([
        {
          id: 1,
          chaptersDownloaded: 2,
          chaptersUnread: 1,
          totalChapters: 2,
          lastReadAt: '2026-07-25T10:00:00.000Z',
          lastUpdatedAt: '2026-07-26T11:00:00.000Z',
        },
        {
          id: 2,
          chaptersDownloaded: 0,
          chaptersUnread: 1,
          totalChapters: 1,
          lastReadAt: '2026-07-24T09:00:00.000Z',
          lastUpdatedAt: '2026-07-24T10:00:00.000Z',
        },
        {
          id: 3,
          chaptersDownloaded: 0,
          chaptersUnread: 0,
          totalChapters: 0,
          lastReadAt: null,
          lastUpdatedAt: null,
        },
      ]);
      expect(
        sqlite.executeSync('SELECT id, novelId FROM Chapter ORDER BY id').rows,
      ).toEqual([
        { id: 1, novelId: 1 },
        { id: 2, novelId: 1 },
        { id: 3, novelId: 2 },
      ]);
      expect(
        sqlite.executeSync('SELECT novelId, categoryId FROM NovelCategory')
          .rows,
      ).toEqual([{ novelId: 1, categoryId: 1 }]);
      expect(sqlite.executeRawSync('PRAGMA foreign_key_check;')).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
