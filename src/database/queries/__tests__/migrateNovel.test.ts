/**
 * Tests for the novel migration service against a real in-memory database.
 */

import './mockDb';
import { setupTestDatabase, getTestDb } from './setup';
import {
  insertTestNovel,
  insertTestCategory,
  insertTestNovelCategory,
} from './testData';
import { fetchNovel } from '@services/plugin/fetch';
import { getString } from '@i18n/translations';
import {
  novelPersistence,
  type NovelPersistenceInput,
} from '@hooks/persisted/useNovel/store-helper/contracts';
import { matchChapters, migrateNovel } from '@services/migrate/migrateNovel';
import { isMigrationPersisted } from '@services/migrate/verifyMigration';
import type { ChapterInfo, NovelInfo } from '@database/types';
import type { BackgroundTaskMetadata } from '@services/backgroundTasks';

jest.mock('@hooks/persisted/useSettings', () => ({
  getLibraryDefaultCategoryId: () => undefined,
}));

jest.mock('@hooks/persisted/useNovel/store-helper/contracts', () => ({
  novelPersistence: {
    copySettings: jest.fn(),
    readLastRead: jest.fn(),
    writeLastRead: jest.fn(),
  },
}));

const mockReadLastRead = novelPersistence.readLastRead as jest.Mock;
const mockWriteLastRead = novelPersistence.writeLastRead as jest.Mock;
const mockFetchNovel = fetchNovel as jest.Mock;

const insertChapters = (
  novelId: number,
  count: number,
  options: { readUpTo?: number; downloaded?: number[] } = {},
) => {
  const { readUpTo = 0, downloaded = [] } = options;
  const values = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const unread = number > readUpTo ? 1 : 0;
    const isDownloaded = downloaded.includes(number) ? 1 : 0;
    return (
      `(${novelId}, '/${novelId}/chapter/${number}', 'Chapter ${number}', ` +
      `${number}, '1', ${index}, ${unread}, ${isDownloaded})`
    );
  }).join(',');
  getTestDb().sqlite.executeSync(
    `INSERT INTO Chapter
      (novelId, path, name, chapterNumber, page, position, unread, isDownloaded)
     VALUES ${values}`,
  );
};

const getChapterRows = (novelId: number) =>
  getTestDb().sqlite.executeSync(
    'SELECT id, name, unread, bookmark, progress, readTime FROM Chapter WHERE novelId = ? ORDER BY position',
    [novelId],
  ).rows as {
    id: number;
    name: string;
    unread: number | null;
    bookmark: number | null;
    progress: number | null;
    readTime: string | null;
  }[];

const novelExists = (novelId: number) =>
  (
    getTestDb().sqlite.executeSync('SELECT id FROM Novel WHERE id = ?', [
      novelId,
    ]).rows as unknown[]
  ).length > 0;

const getNovelRow = (novelId: number) =>
  getTestDb().sqlite.executeSync('SELECT * FROM Novel WHERE id = ?', [novelId])
    .rows[0] as unknown as NovelInfo;

const triggerNames = () =>
  getTestDb()
    .sqlite.executeSync("SELECT name FROM sqlite_master WHERE type = 'trigger'")
    .rows.map(row => (row as { name: string }).name);

const TO_PATH = '/to/novel';

const setupNovels = async () => {
  const testDb = getTestDb();
  const fromId = await insertTestNovel(testDb, {
    name: 'Novel',
    path: '/from/novel',
    pluginId: 'from-plugin',
    inLibrary: true,
  });
  const toId = await insertTestNovel(testDb, {
    name: 'Novel',
    path: TO_PATH,
    pluginId: 'to-plugin',
    inLibrary: false,
  });
  return { fromId, toId };
};

const run = async (
  fromId: number,
  toId: number,
  options?: { redownloadChapters?: boolean },
) => {
  const fromNovel = getNovelRow(fromId);
  const meta: BackgroundTaskMetadata = {
    name: 'Migrate',
    isRunning: false,
    progress: undefined,
    progressText: undefined,
  };
  let latest = meta;
  const enqueue = jest.fn();
  await migrateNovel(
    {
      pluginId: 'to-plugin',
      fromNovel,
      toNovelPath: TO_PATH,
      options: {
        cover: 'current',
        metadata: 'current',
        redownloadChapters: options?.redownloadChapters ?? true,
      },
    },
    transformer => {
      latest = transformer(latest);
    },
    enqueue,
  );
  return { enqueue, meta: () => latest };
};

describe('migrateNovel', () => {
  beforeEach(() => {
    setupTestDatabase();
    jest.clearAllMocks();
    mockReadLastRead.mockReturnValue(undefined);
  });

  it('keeps all read chapters when the novel has more than 1000 chapters', async () => {
    const readCount = 2500;
    const total = readCount + 500;
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, total, { readUpTo: readCount });
    insertChapters(toId, total);

    await run(fromId, toId);

    const rows = getChapterRows(toId);
    expect(rows).toHaveLength(total);
    expect(rows.filter(row => !row.unread)).toHaveLength(readCount);
    expect(rows[readCount - 1].unread).toBe(0);
    expect(rows[readCount].unread).toBe(1);
    expect(novelExists(fromId)).toBe(false);
    expect(getNovelRow(toId).inLibrary).toBeTruthy();
  });

  it('reports read chapters that have no match in the destination', async () => {
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, 1500, { readUpTo: 1500 });
    insertChapters(toId, 1000);

    const { meta } = await run(fromId, toId);

    const rows = getChapterRows(toId);
    expect(rows.every(row => !row.unread)).toBe(true);
    expect(getString).toHaveBeenCalledWith(
      'browseScreen.migration.unmatchedReadChapters',
      { count: 500 },
    );
    expect(meta().completionText).toBe(
      'browseScreen.migration.unmatchedReadChapters',
    );
  });

  it('does not set a warning when every read chapter matched', async () => {
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, 10, { readUpTo: 10 });
    insertChapters(toId, 12);

    const { meta } = await run(fromId, toId);

    expect(meta().completionText).toBeUndefined();
    expect(getChapterRows(toId).filter(row => row.unread)).toHaveLength(2);
  });

  it('moves categories and the last-read chapter to the destination', async () => {
    const { fromId, toId } = await setupNovels();
    const categoryId = await insertTestCategory(getTestDb(), { name: 'Fav' });
    await insertTestNovelCategory(getTestDb(), fromId, categoryId);
    insertChapters(fromId, 5, { readUpTo: 3 });
    insertChapters(toId, 5);
    const fromRows = getChapterRows(fromId);
    mockReadLastRead.mockReturnValue({ id: fromRows[2].id });

    await run(fromId, toId);

    const categories = getTestDb().sqlite.executeSync(
      'SELECT novelId FROM NovelCategory WHERE categoryId = ?',
      [categoryId],
    ).rows as { novelId: number }[];
    expect(categories.map(row => row.novelId)).toEqual([toId]);
    const toRows = getChapterRows(toId);
    expect(mockWriteLastRead).toHaveBeenCalledWith(
      expect.objectContaining<Partial<NovelPersistenceInput>>({
        pluginId: 'to-plugin',
        novelPath: TO_PATH,
      }),
      expect.objectContaining({ id: toRows[2].id }),
    );
  });

  it('refuses to migrate a novel that an earlier migration already consumed', async () => {
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, 3, { readUpTo: 3 });
    insertChapters(toId, 3);
    const staleFromNovel = getNovelRow(fromId);
    await run(fromId, toId);
    getTestDb().sqlite.executeSync(
      `UPDATE Novel SET inLibrary = 0 WHERE id = ${toId}`,
    );

    await expect(
      migrateNovel(
        {
          pluginId: 'to-plugin',
          fromNovel: staleFromNovel,
          toNovelPath: TO_PATH,
        },
        jest.fn(),
        jest.fn(),
      ),
    ).rejects.toThrow('no longer exists');

    expect(getNovelRow(toId).inLibrary).toBeFalsy();
  });

  it('keeps the destination in a category it already shares with the source', async () => {
    const { fromId, toId } = await setupNovels();
    const shared = await insertTestCategory(getTestDb(), { name: 'Shared' });
    const onlySource = await insertTestCategory(getTestDb(), { name: 'Own' });
    await insertTestNovelCategory(getTestDb(), fromId, shared);
    await insertTestNovelCategory(getTestDb(), fromId, onlySource);
    await insertTestNovelCategory(getTestDb(), toId, shared);
    insertChapters(fromId, 2);
    insertChapters(toId, 2);

    await run(fromId, toId);

    const rows = getTestDb().sqlite.executeSync(
      'SELECT novelId, categoryId FROM NovelCategory ORDER BY categoryId',
    ).rows as { novelId: number; categoryId: number }[];
    expect(rows).toEqual([
      { novelId: toId, categoryId: shared },
      { novelId: toId, categoryId: onlySource },
    ]);
    expect(novelExists(fromId)).toBe(false);
  });

  it('queues only matched downloaded chapters for re-download', async () => {
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, 5, { downloaded: [1, 3, 5] });
    insertChapters(toId, 3);

    const { enqueue } = await run(fromId, toId);

    expect(enqueue).toHaveBeenCalledTimes(1);
    const task = enqueue.mock.calls[0][0];
    expect(task.name).toBe('DOWNLOAD_CHAPTER');
    expect(
      task.data.chapters.map((c: { chapterName: string }) => c.chapterName),
    ).toEqual(['Chapter 1', 'Chapter 3']);
  });

  it('leaves the source novel and its progress untouched when the destination cannot be loaded', async () => {
    const testDb = getTestDb();
    const fromId = await insertTestNovel(testDb, {
      name: 'Novel',
      path: '/from/novel',
      pluginId: 'from-plugin',
      inLibrary: true,
    });
    insertChapters(fromId, 20, { readUpTo: 20 });
    mockFetchNovel.mockRejectedValueOnce(new Error('network down'));

    await expect(
      migrateNovel(
        {
          pluginId: 'to-plugin',
          fromNovel: getNovelRow(fromId),
          toNovelPath: TO_PATH,
        },
        jest.fn(),
        jest.fn(),
      ),
    ).rejects.toThrow('network down');

    expect(novelExists(fromId)).toBe(true);
    expect(getChapterRows(fromId).every(row => !row.unread)).toBe(true);
    expect(
      isMigrationPersisted({
        fromNovelId: fromId,
        pluginId: 'to-plugin',
        toNovelPath: TO_PATH,
      }),
    ).toBe(false);
  });

  it('rolls back everything when a write inside the migration fails', async () => {
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, 10, { readUpTo: 10 });
    insertChapters(toId, 10);
    getTestDb().sqlite.executeSync(
      `CREATE TRIGGER fail_chapter_update BEFORE UPDATE OF unread ON Chapter
       WHEN NEW.novelId = ${toId} AND NEW.name = 'Chapter 7'
       BEGIN SELECT RAISE(ABORT, 'forced failure'); END`,
    );

    await expect(run(fromId, toId)).rejects.toThrow('forced failure');

    expect(novelExists(fromId)).toBe(true);
    expect(getChapterRows(fromId).every(row => !row.unread)).toBe(true);
    expect(getChapterRows(toId).every(row => row.unread)).toBe(true);
    expect(getNovelRow(toId).inLibrary).toBeFalsy();
    expect(triggerNames()).toEqual(
      expect.arrayContaining([
        'update_novel_stats_on_update',
        'update_novel_stats_on_delete',
      ]),
    );
  });

  it('preserves NULL read and bookmark flags and copies progress', async () => {
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, 2);
    insertChapters(toId, 2);
    getTestDb().sqlite.executeSync(
      `UPDATE Chapter SET unread = NULL, bookmark = NULL WHERE novelId = ${fromId} AND name = 'Chapter 1'`,
    );
    getTestDb().sqlite.executeSync(
      `UPDATE Chapter SET bookmark = 1, progress = 40, readTime = '2024-01-01 00:00:00' WHERE novelId = ${fromId} AND name = 'Chapter 2'`,
    );

    await run(fromId, toId);

    const [first, second] = getChapterRows(toId);
    expect([first.unread, first.bookmark]).toEqual([null, null]);
    expect(second.bookmark).toBeTruthy();
    expect(second.progress).toBe(40);
    expect(second.readTime).toBe('2024-01-01 00:00:00');
  });

  it('removes the source chapters and refreshes the destination counters', async () => {
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, 5, { readUpTo: 3 });
    insertChapters(toId, 5);

    await run(fromId, toId);

    expect(getChapterRows(fromId)).toHaveLength(0);
    expect(
      (getNovelRow(toId) as unknown as { chaptersUnread: number })
        .chaptersUnread,
    ).toBe(2);
    expect(triggerNames()).toEqual(
      expect.arrayContaining([
        'update_novel_stats_on_update',
        'update_novel_stats_on_delete',
      ]),
    );
  });

  it('reports a persisted migration only once the destination is in the library and the source is gone', async () => {
    const { fromId, toId } = await setupNovels();
    insertChapters(fromId, 3, { readUpTo: 1 });
    insertChapters(toId, 3);
    const target = {
      fromNovelId: fromId,
      pluginId: 'to-plugin',
      toNovelPath: TO_PATH,
    };

    expect(isMigrationPersisted(target)).toBe(false);
    await run(fromId, toId);
    expect(isMigrationPersisted(target)).toBe(true);
  });
});

describe('matchChapters', () => {
  const chapter = (id: number, chapterNumber: number | null): ChapterInfo =>
    ({ id, name: `c${id}`, chapterNumber } as ChapterInfo);

  it('pairs chapters by number regardless of input order or gaps', () => {
    const matches = matchChapters(
      'Novel',
      [chapter(1, 3), chapter(2, 1), chapter(3, 2)],
      'Novel',
      [chapter(10, 2), chapter(11, 3), chapter(12, 4)],
    );

    expect(matches.map(m => [m.from.id, m.to.id])).toEqual([
      [3, 10],
      [1, 11],
    ]);
  });

  it('never pairs the same chapter twice', () => {
    const matches = matchChapters(
      'Novel',
      [chapter(1, 1), chapter(2, 2)],
      'Novel',
      [chapter(10, 1), chapter(11, 2)],
    );

    expect(new Set(matches.map(m => m.from.id)).size).toBe(matches.length);
    expect(new Set(matches.map(m => m.to.id)).size).toBe(matches.length);
  });
});
