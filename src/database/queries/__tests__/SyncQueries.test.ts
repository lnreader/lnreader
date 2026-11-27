import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import {
  insertTestNovel,
  insertTestChapter,
  insertTestCategory,
  insertTestNovelCategory,
  clearAllTables,
} from './testData';
import {
  chapterSchema,
  novelCategorySchema,
  novelSchema,
} from '@database/schema';
import { eq, and } from 'drizzle-orm';
import { BUILT_IN_CATEGORY_IDS } from '@database/constants';
import {
  queryActiveSyncEntities,
  mergeRemoteSyncPayload,
} from '../SyncQueries';
import type { SyncDevicePayload } from '@services/sync/types';

describe('SyncQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('queryActiveSyncEntities', () => {
    it('returns only library novels and active chapters', async () => {
      const testDb = getTestDb();

      // Novel 1: in library
      const libNovelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-1',
        path: '/novel-1',
        name: 'Library Novel',
        inLibrary: true,
      });

      // Novel 2: not in library
      const nonLibNovelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-1',
        path: '/novel-2',
        name: 'Non Library Novel',
        inLibrary: false,
      });

      // Category for libNovel
      const catId = await insertTestCategory(testDb, { name: 'Fantasy' });
      await insertTestNovelCategory(testDb, libNovelId, catId);

      // Chapters for libNovel:
      // 1. Inactive chapter (unread = true, progress = 0, no bookmark, no readTime)
      await insertTestChapter(testDb, libNovelId, {
        path: '/ch-inactive',
        name: 'Inactive Chapter',
        unread: true,
        progress: 0,
        bookmark: false,
        readTime: null,
      });

      // 2. Active chapter: read (unread = false)
      await insertTestChapter(testDb, libNovelId, {
        path: '/ch-read',
        name: 'Read Chapter',
        unread: false,
        progress: 100,
        bookmark: false,
      });

      // 3. Active chapter: partial progress (progress = 45)
      await insertTestChapter(testDb, libNovelId, {
        path: '/ch-progress',
        name: 'Progress Chapter',
        unread: true,
        progress: 45,
        bookmark: false,
      });

      // 4. Active chapter: bookmarked
      await insertTestChapter(testDb, libNovelId, {
        path: '/ch-bookmark',
        name: 'Bookmark Chapter',
        unread: true,
        progress: 0,
        bookmark: true,
      });

      // Chapter for non-library novel (even if active, should NOT be returned)
      await insertTestChapter(testDb, nonLibNovelId, {
        path: '/ch-non-lib',
        name: 'Non Lib Chapter',
        unread: false,
        progress: 100,
      });

      const result = await queryActiveSyncEntities();

      expect(result.novels).toHaveLength(1);
      expect(result.novels[0].name).toBe('Library Novel');
      expect(result.novels[0].categoryNames).toEqual(['Fantasy']);

      expect(result.chapters).toHaveLength(3);
      const chapterPaths = result.chapters.map(c => c.chapterPath);
      expect(chapterPaths).toContain('/ch-read');
      expect(chapterPaths).toContain('/ch-progress');
      expect(chapterPaths).toContain('/ch-bookmark');
      expect(chapterPaths).not.toContain('/ch-inactive');
      expect(chapterPaths).not.toContain('/ch-non-lib');
    });
  });

  describe('mergeRemoteSyncPayload', () => {
    it('applies Asymmetric Insert Rule: missing novel is inserted with inLibrary = true and default category', async () => {
      const testDb = getTestDb();

      const payload: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/remote-novel-1',
            name: 'Remote Novel 1',
            cover: 'https://example.com/cover.jpg',
            author: 'Remote Author',
            status: 'Ongoing',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [],
        categories: [],
      };

      await mergeRemoteSyncPayload(payload);

      const inserted = await testDb.drizzleDb
        .select()
        .from(novelSchema)
        .where(
          and(
            eq(novelSchema.pluginId, 'plugin-test'),
            eq(novelSchema.path, '/remote-novel-1'),
          ),
        )
        .get();

      expect(inserted).toBeDefined();
      expect(inserted!.inLibrary).toBe(true);
      expect(inserted!.name).toBe('Remote Novel 1');

      // Check default category was mapped
      const categories = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, inserted!.id))
        .all();

      expect(categories).toHaveLength(1);
      expect(categories[0].categoryId).toBe(BUILT_IN_CATEGORY_IDS.default);
    });

    it('applies Asymmetric Insert Rule: existing novel with inLibrary = false preserves inLibrary = false', async () => {
      const testDb = getTestDb();

      // Locally user deleted novel from library
      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: '/novel-deleted',
        name: 'Deleted Novel',
        inLibrary: false,
      });

      const payload: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-deleted',
            name: 'Deleted Novel',
            inLibrary: true,
            categoryNames: ['Some Cat'],
          },
        ],
        chapters: [],
        categories: [],
      };

      await mergeRemoteSyncPayload(payload);

      const localNovel = await testDb.drizzleDb
        .select()
        .from(novelSchema)
        .where(eq(novelSchema.id, novelId))
        .get();

      expect(localNovel!.inLibrary).toBe(false);
    });

    it('merges chapters monotonically and preserves local downloads without row deletion', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: '/novel-chapters',
        name: 'Novel with Chapters',
        inLibrary: true,
      });

      // Chapter 1: locally read = false (read), progress = 100, isDownloaded = true
      const ch1Id = await insertTestChapter(testDb, novelId, {
        path: '/ch-1',
        name: 'Chapter 1',
        unread: false,
        progress: 100,
        isDownloaded: true,
        readTime: '2026-01-01T00:00:00.000Z',
      });

      // Chapter 2: locally unread = true, progress = 20, isDownloaded = true
      const ch2Id = await insertTestChapter(testDb, novelId, {
        path: '/ch-2',
        name: 'Chapter 2',
        unread: true,
        progress: 20,
        isDownloaded: true,
        bookmark: false,
        readTime: '2026-01-01T00:00:00.000Z',
        page: '2',
      });

      const payload: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-chapters',
            name: 'Novel with Chapters',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          // Remote ch1 has unread = true (device B has not read it yet)
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-chapters',
            chapterPath: '/ch-1',
            name: 'Chapter 1',
            unread: true,
            progress: 0,
            bookmark: false,
            readTime: null,
          },
          // Remote ch2 has higher progress (80%) and newer timestamp and bookmark
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-chapters',
            chapterPath: '/ch-2',
            name: 'Chapter 2',
            unread: true,
            progress: 80,
            bookmark: true,
            readTime: '2026-01-02T12:00:00.000Z',
            page: '8',
          },
          // Remote ch3 does not exist locally
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-chapters',
            chapterPath: '/ch-3',
            name: 'Chapter 3',
            unread: false,
            progress: 100,
            bookmark: false,
            readTime: '2026-01-02T15:00:00.000Z',
            page: '1',
          },
        ],
        categories: [],
      };

      await mergeRemoteSyncPayload(payload);

      // Verify Chapter 1:
      const mergedCh1 = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.id, ch1Id))
        .get();

      expect(mergedCh1!.id).toBe(ch1Id); // Row was preserved, not deleted!
      expect(mergedCh1!.unread).toBe(false); // Monotonic read: remained read!
      expect(mergedCh1!.progress).toBe(100);
      expect(mergedCh1!.isDownloaded).toBe(true); // Download state untouched!

      // Verify Chapter 2:
      const mergedCh2 = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.id, ch2Id))
        .get();

      expect(mergedCh2!.id).toBe(ch2Id);
      expect(mergedCh2!.progress).toBe(80); // Progress updated to higher value
      expect(mergedCh2!.bookmark).toBe(true); // Bookmark union
      expect(mergedCh2!.readTime).toBe('2026-01-02T12:00:00.000Z');
      expect(mergedCh2!.page).toBe('8'); // Page updated because remote readTime was newer
      expect(mergedCh2!.isDownloaded).toBe(true); // Download state untouched!

      // Verify Chapter 3 (newly inserted):
      const insertedCh3 = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(
          and(
            eq(chapterSchema.novelId, novelId),
            eq(chapterSchema.path, '/ch-3'),
          ),
        )
        .get();

      expect(insertedCh3).toBeDefined();
      expect(insertedCh3!.unread).toBe(false);
      expect(insertedCh3!.progress).toBe(100);
      expect(insertedCh3!.isDownloaded).toBe(false); // Default false for remote-inserted chapter
    });

    it('does not crash on duplicate chapter entries in payload and deduplicates batch insert', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: '/novel-dup-chapters',
        name: 'Novel with Dup Chapters',
        inLibrary: true,
      });

      const payload: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-dup-chapters',
            name: 'Novel with Dup Chapters',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          // Two chapters with identical chapterPath
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-dup-chapters',
            chapterPath: '/ch-duplicate',
            name: 'Duplicate Chapter A',
            unread: true,
            progress: 10,
            bookmark: false,
            readTime: null,
          },
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-dup-chapters',
            chapterPath: '/ch-duplicate',
            name: 'Duplicate Chapter B',
            unread: true,
            progress: 20,
            bookmark: false,
            readTime: null,
          },
        ],
        categories: [],
      };

      // Should not throw SQLite UNIQUE constraint error
      await expect(mergeRemoteSyncPayload(payload)).resolves.not.toThrow();

      const inserted = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(
          and(
            eq(chapterSchema.novelId, novelId),
            eq(chapterSchema.path, '/ch-duplicate'),
          ),
        )
        .all();

      expect(inserted).toHaveLength(1);
    });

    it('does not assign categories or default category to novel when inLibrary is false', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: '/novel-non-lib',
        name: 'Non Library Novel',
        inLibrary: false,
      });

      const payload: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-non-lib',
            name: 'Non Library Novel',
            inLibrary: true,
            categoryNames: ['Action', 'Fantasy'],
          },
        ],
        chapters: [],
        categories: [{ name: 'Action' }, { name: 'Fantasy' }],
      };

      await mergeRemoteSyncPayload(payload);

      const assignedCategories = await testDb.drizzleDb
        .select()
        .from(novelCategorySchema)
        .where(eq(novelCategorySchema.novelId, novelId))
        .all();

      expect(assignedCategories).toHaveLength(0);
    });

    it('sanitizes NaN and non-finite progress values safely', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: '/novel-nan-progress',
        name: 'Novel NaN Progress',
        inLibrary: true,
      });

      const payload: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-nan-progress',
            name: 'Novel NaN Progress',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-nan-progress',
            chapterPath: '/ch-nan',
            name: 'Chapter NaN',
            unread: true,
            progress: NaN,
            bookmark: false,
            readTime: null,
          },
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-nan-progress',
            chapterPath: '/ch-infinity',
            name: 'Chapter Infinity',
            unread: true,
            progress: Infinity,
            bookmark: false,
            readTime: null,
          },
        ],
        categories: [],
      };

      await expect(mergeRemoteSyncPayload(payload)).resolves.not.toThrow();

      const chNan = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(
          and(
            eq(chapterSchema.novelId, novelId),
            eq(chapterSchema.path, '/ch-nan'),
          ),
        )
        .get();

      expect(chNan?.progress).toBe(0);

      const chInf = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(
          and(
            eq(chapterSchema.novelId, novelId),
            eq(chapterSchema.path, '/ch-infinity'),
          ),
        )
        .get();

      expect(chInf?.progress).toBe(0);
    });

    it('handles novel paths containing colons and avoids delimiter split issues', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: 'https://example.com/novel:::with:::colons',
        name: 'Colon Novel',
        inLibrary: true,
      });

      const payload: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [],
        chapters: [
          {
            novelPluginId: 'plugin-test',
            novelPath: 'https://example.com/novel:::with:::colons',
            chapterPath: '/ch-colon-1',
            name: 'Chapter Colon 1',
            unread: false,
            progress: 50,
            bookmark: true,
            readTime: '2026-02-01T12:00:00.000Z',
          },
        ],
        categories: [],
      };

      await expect(mergeRemoteSyncPayload(payload)).resolves.not.toThrow();

      const ch = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(
          and(
            eq(chapterSchema.novelId, novelId),
            eq(chapterSchema.path, '/ch-colon-1'),
          ),
        )
        .get();

      expect(ch).toBeDefined();
      expect(ch?.bookmark).toBe(true);
      expect(ch?.progress).toBe(50);
    });

    it('correctly compares local datetime without T against remote ISO timestamp', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: '/novel-local-time',
        name: 'Novel Local Time',
        inLibrary: true,
      });

      const chId = await insertTestChapter(testDb, novelId, {
        path: '/ch-time',
        name: 'Chapter Time',
        unread: false,
        progress: 50,
        readTime: '2026-06-12 15:30:00', // SQLite local datetime format without 'T'
        page: '1',
      });

      // Older remote time should NOT overwrite newer local time
      const payloadOlder: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-local-time',
            name: 'Novel Local Time',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-local-time',
            chapterPath: '/ch-time',
            name: 'Chapter Time',
            unread: false,
            progress: 50,
            bookmark: false,
            readTime: '2026-06-12T10:00:00.000Z', // 5 hours earlier
            page: '99',
          },
        ],
        categories: [],
      };

      await mergeRemoteSyncPayload(payloadOlder);

      const chAfterOlder = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.id, chId))
        .get();

      expect(chAfterOlder?.readTime).toBe('2026-06-12 15:30:00');
      expect(chAfterOlder?.page).toBe('1'); // not overwritten by older remote page 99

      // Newer remote time SHOULD overwrite local time
      const payloadNewer: SyncDevicePayload = {
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-local-time',
            name: 'Novel Local Time',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-local-time',
            chapterPath: '/ch-time',
            name: 'Chapter Time',
            unread: false,
            progress: 50,
            bookmark: false,
            readTime: '2026-06-12T18:00:00.000Z', // later
            page: '42',
          },
        ],
        categories: [],
      };

      await mergeRemoteSyncPayload(payloadNewer);

      const chAfterNewer = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.id, chId))
        .get();

      expect(chAfterNewer?.readTime).toBe('2026-06-12T18:00:00.000Z');
      expect(chAfterNewer?.page).toBe('42');
    });

    it('excludes local EPUB novels from queryActiveSyncEntities and ignores them on merge', async () => {
      const testDb = getTestDb();

      const localNovelId = await insertTestNovel(testDb, {
        pluginId: 'local',
        path: '/storage/emulated/0/book.epub',
        name: 'Local EPUB',
        inLibrary: true,
        isLocal: true,
      });
      await insertTestChapter(testDb, localNovelId, {
        path: '/storage/emulated/0/book.epub/ch1',
        name: 'EPUB Chapter 1',
        unread: false,
        progress: 100,
      });

      const active = await queryActiveSyncEntities();
      expect(active.novels).toHaveLength(0);
      expect(active.chapters).toHaveLength(0);

      await mergeRemoteSyncPayload({
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'local',
            path: '/remote/book.epub',
            name: 'Remote Local EPUB',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          {
            novelPluginId: 'local',
            novelPath: '/remote/book.epub',
            chapterPath: '/remote/book.epub/ch1',
            name: 'EPUB Chapter 1',
            unread: false,
            progress: 100,
            bookmark: false,
            readTime: null,
          },
        ],
        categories: [],
      });

      const allNovels = await testDb.drizzleDb.select().from(novelSchema).all();
      expect(allNovels).toHaveLength(1);
      expect(allNovels[0].id).toBe(localNovelId);
    });

    it('preserves chapter position on export and import', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: '/novel-pos',
        name: 'Position Novel',
        inLibrary: true,
      });
      await insertTestChapter(testDb, novelId, {
        path: '/ch-pos-5',
        name: 'Chapter 5',
        unread: false,
        progress: 100,
        position: 5,
      });

      const exported = await queryActiveSyncEntities();
      expect(exported.chapters[0].position).toBe(5);

      await mergeRemoteSyncPayload({
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-pos-remote',
            name: 'Remote Position Novel',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-pos-remote',
            chapterPath: '/ch-pos-12',
            name: 'Chapter 12',
            unread: false,
            progress: 100,
            bookmark: false,
            readTime: null,
            position: 12,
          },
        ],
        categories: [],
      });

      const insertedNovel = await testDb.drizzleDb
        .select()
        .from(novelSchema)
        .where(eq(novelSchema.path, '/novel-pos-remote'))
        .get();
      const insertedChapter = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, insertedNovel!.id))
        .get();

      expect(insertedChapter?.position).toBe(12);
    });

    it('lets newer explicit chapter edits (unread, reset progress, unbookmark) survive merge', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, {
        pluginId: 'plugin-test',
        path: '/novel-edits',
        name: 'Edits Novel',
        inLibrary: true,
      });

      // Local chapter was explicitly marked unread, progress reset, unbookmarked at T2
      const chId = await insertTestChapter(testDb, novelId, {
        path: '/ch-edited',
        name: 'Edited Chapter',
        unread: true,
        progress: 0,
        bookmark: false,
        readTime: null,
        syncUpdatedAt: '2026-06-15T12:00:00.000Z',
      });

      // Export should still include it because syncUpdatedAt is set
      const exported = await queryActiveSyncEntities();
      expect(exported.chapters).toHaveLength(1);
      expect(exported.chapters[0].syncUpdatedAt).toBe(
        '2026-06-15T12:00:00.000Z',
      );

      // Older peer payload (T1) must NOT reverse local edits
      await mergeRemoteSyncPayload({
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-edits',
            name: 'Edits Novel',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-edits',
            chapterPath: '/ch-edited',
            name: 'Edited Chapter',
            unread: false,
            progress: 100,
            bookmark: true,
            readTime: '2026-06-14T10:00:00.000Z',
            syncUpdatedAt: '2026-06-14T10:00:00.000Z',
          },
        ],
        categories: [],
      });

      const afterOlder = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.id, chId))
        .get();
      expect(afterOlder?.unread).toBe(true);
      expect(afterOlder?.progress).toBe(0);
      expect(afterOlder?.bookmark).toBe(false);

      // Newer remote explicit edit (T3) SHOULD overwrite local state
      await mergeRemoteSyncPayload({
        version: 1,
        deviceId: 'device-b',
        lastUpdated: Date.now(),
        novels: [
          {
            pluginId: 'plugin-test',
            path: '/novel-edits',
            name: 'Edits Novel',
            inLibrary: true,
            categoryNames: [],
          },
        ],
        chapters: [
          {
            novelPluginId: 'plugin-test',
            novelPath: '/novel-edits',
            chapterPath: '/ch-edited',
            name: 'Edited Chapter',
            unread: false,
            progress: 50,
            bookmark: true,
            readTime: '2026-06-16T10:00:00.000Z',
            syncUpdatedAt: '2026-06-16T10:00:00.000Z',
          },
        ],
        categories: [],
      });

      const afterNewer = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.id, chId))
        .get();
      expect(afterNewer?.unread).toBe(false);
      expect(afterNewer?.progress).toBe(50);
      expect(afterNewer?.bookmark).toBe(true);
    });
  });
});
