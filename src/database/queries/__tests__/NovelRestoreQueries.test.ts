import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, insertTestChapter, clearAllTables } from './testData';
import { chapterSchema, novelSchema } from '@database/schema';
import { and, eq } from 'drizzle-orm';

import { getNovelByPath } from '../NovelQueries';
import {
  clearRestoreChapterMappings,
  getRestoreChapterMappings,
  restoreLibrary,
  _restoreNovelAndChapters,
  _restoreNovelsAndChapters,
} from '../NovelRestoreQueries';

const mockGetLibraryDefaultCategoryId = jest.fn<number | undefined, []>();

jest.mock('@hooks/persisted/useSettings', () => ({
  getLibraryDefaultCategoryId: () => mockGetLibraryDefaultCategoryId(),
}));

describe('NovelRestoreQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
    mockGetLibraryDefaultCategoryId.mockReturnValue(undefined);
  });

  afterAll(() => {
    teardownTestDatabase();
  });
  describe('restoreLibrary', () => {
    it('should restore novel from backup', async () => {
      const novel = {
        id: 999,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Restored Novel',
        cover: null,
        summary: null,
        author: null,
        artist: null,
        status: 'Ongoing',
        genres: null,
        inLibrary: true,
        isLocal: false,
        totalPages: 1,
        chaptersDownloaded: 0,
        chaptersUnread: 0,
        totalChapters: 0,
        lastReadAt: null,
        lastUpdatedAt: null,
      };

      // Mock fetchNovel to return a valid SourceNovel
      const { fetchNovel } = require('@services/plugin/fetch');
      jest.mocked(fetchNovel).mockResolvedValueOnce({
        id: undefined,
        path: '/test/novel',
        name: 'Restored Novel',
        chapters: [],
      });

      await restoreLibrary(novel);

      const restored = await getNovelByPath('/test/novel', 'test-plugin');
      expect(restored?.name).toBe('Restored Novel');
    });
  });

  describe('_restoreNovelAndChapters', () => {
    it('does not replace an unrelated novel when backup IDs collide', async () => {
      const testDb = getTestDb();
      await insertTestNovel(testDb, {
        path: '/existing/novel',
        pluginId: 'existing-plugin',
        name: 'Existing Novel',
        inLibrary: true,
      });

      const mapping = await _restoreNovelAndChapters(
        {
          id: 1,
          path: '/restored/novel',
          pluginId: 'restored-plugin',
          name: 'Restored Novel',
          cover: null,
          summary: null,
          author: null,
          artist: null,
          status: 'Ongoing',
          genres: null,
          inLibrary: true,
          isLocal: false,
          totalPages: 0,
          chapters: [
            {
              id: 10,
              novelId: 1,
              path: '/restored/chapter-1',
              name: 'Chapter 1',
              releaseTime: null,
              readTime: null,
              bookmark: false,
              unread: true,
              isDownloaded: true,
              updatedTime: null,
              chapterNumber: 1,
              page: '1',
              progress: null,
              position: 0,
              scanlator: null,
              timeSpent: 0,
            },
          ],
        },
        { restoreRunId: 'restore-collision' },
      );

      expect(mapping.restoredNovelId).not.toBe(1);
      expect(
        (await getNovelByPath('/existing/novel', 'existing-plugin'))?.name,
      ).toBe('Existing Novel');
      expect(
        (await getNovelByPath('/restored/novel', 'restored-plugin'))?.id,
      ).toBe(mapping.restoredNovelId);
      const restoredChapters = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, mapping.restoredNovelId))
        .all();
      expect(restoredChapters).toHaveLength(1);
      expect(restoredChapters[0].path).toBe('/restored/chapter-1');
    });
    it('restores multiple novels in one batch', async () => {
      const mappings = await _restoreNovelsAndChapters(
        [
          {
            id: 100,
            path: '/bulk/one',
            pluginId: 'bulk-plugin',
            name: 'Bulk One',
            chapters: [],
          },
          {
            id: 101,
            path: '/bulk/two',
            pluginId: 'bulk-plugin',
            name: 'Bulk Two',
            chapters: [],
          },
        ],
        { includeChapterMappings: false },
      );

      expect(mappings).toHaveLength(2);
      expect(mappings.map(mapping => mapping.pluginId)).toEqual([
        'bulk-plugin',
        'bulk-plugin',
      ]);
      expect(await getNovelByPath('/bulk/one', 'bulk-plugin')).toEqual(
        expect.objectContaining({ name: 'Bulk One' }),
      );
      expect(await getNovelByPath('/bulk/two', 'bulk-plugin')).toEqual(
        expect.objectContaining({ name: 'Bulk Two' }),
      );
    });
    it('preserves mappings and aggregate stats for multiple novels', async () => {
      await _restoreNovelsAndChapters(
        [
          {
            id: 200,
            path: '/bulk/mapped-one',
            pluginId: 'bulk-plugin',
            name: 'Mapped One',
            chapters: [
              {
                id: 2001,
                novelId: 200,
                path: '/bulk/chapter-one',
                name: 'Chapter One',
                releaseTime: null,
                readTime: '2024-01-01T00:00:00.000Z',
                bookmark: false,
                unread: true,
                isDownloaded: true,
                updatedTime: '2024-01-01T00:00:00.000Z',
                chapterNumber: 1,
                page: '1',
                progress: null,
                position: 0,
                scanlator: null,
                timeSpent: 0,
              },
              {
                id: 2002,
                novelId: 200,
                path: '/bulk/chapter-two',
                name: 'Chapter Two',
                releaseTime: null,
                readTime: '2025-01-01T00:00:00.000Z',
                bookmark: false,
                unread: false,
                isDownloaded: false,
                updatedTime: '2023-01-01T00:00:00.000Z',
                chapterNumber: 2,
                page: '1',
                progress: null,
                position: 1,
                scanlator: null,
                timeSpent: 0,
              },
            ],
          },
          {
            id: 201,
            path: '/bulk/mapped-two',
            pluginId: 'bulk-plugin',
            name: 'Mapped Two',
            chapters: [
              {
                id: 2011,
                novelId: 201,
                path: '/bulk/chapter-three',
                name: 'Chapter Three',
                releaseTime: null,
                readTime: null,
                bookmark: false,
                unread: true,
                isDownloaded: true,
                updatedTime: '2026-01-01T00:00:00.000Z',
                chapterNumber: 1,
                page: '1',
                progress: null,
                position: 0,
                scanlator: null,
                timeSpent: 0,
              },
            ],
          },
        ],
        { includeChapterMappings: true, restoreRunId: 'restore-mappings' },
      );

      const stagedMappingsOne = await getRestoreChapterMappings(
        'restore-mappings',
        200,
        [2001, 2002],
      );
      const stagedMappingsTwo = await getRestoreChapterMappings(
        'restore-mappings',
        201,
        [2011],
      );
      expect(
        stagedMappingsOne.map(row => row.backupChapterId).sort((a, b) => a - b),
      ).toEqual([2001, 2002]);
      expect(stagedMappingsTwo.map(row => row.backupChapterId)).toEqual([2011]);
      expect(
        new Set(
          [...stagedMappingsOne, ...stagedMappingsTwo].map(
            row => row.restoredChapterId,
          ),
        ).size,
      ).toBe(3);
      expect(await getNovelByPath('/bulk/mapped-one', 'bulk-plugin')).toEqual(
        expect.objectContaining({
          totalChapters: 2,
          chaptersDownloaded: 1,
          chaptersUnread: 1,
          lastReadAt: '2025-01-01T00:00:00.000Z',
          lastUpdatedAt: '2024-01-01T00:00:00.000Z',
        }),
      );
      expect(await getNovelByPath('/bulk/mapped-two', 'bulk-plugin')).toEqual(
        expect.objectContaining({
          totalChapters: 1,
          chaptersDownloaded: 1,
          chaptersUnread: 1,
          lastReadAt: null,
          lastUpdatedAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    });
    it('restores chapters without allocating ID mappings when requested', async () => {
      const mapping = await _restoreNovelAndChapters(
        {
          id: 2,
          path: '/restored/without-mappings',
          pluginId: 'restored-plugin',
          name: 'Restored Without Mappings',
          cover: null,
          summary: null,
          author: null,
          artist: null,
          status: 'Ongoing',
          genres: null,
          inLibrary: true,
          isLocal: false,
          totalPages: 0,
          chapters: [
            {
              id: 20,
              novelId: 2,
              path: '/restored/chapter-2',
              name: 'Chapter 2',
              releaseTime: null,
              readTime: null,
              bookmark: false,
              unread: true,
              isDownloaded: false,
              updatedTime: null,
              chapterNumber: 2,
              page: '1',
              progress: null,
              position: 0,
              scanlator: null,
              timeSpent: 0,
            },
          ],
        },
        { includeChapterMappings: false },
      );

      const restoredChapters = await getTestDb()
        .drizzleDb.select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, mapping.restoredNovelId))
        .all();
      expect(restoredChapters).toHaveLength(1);
      expect(restoredChapters[0].path).toBe('/restored/chapter-2');
      expect(
        await getRestoreChapterMappings('without-mappings', 2, [20]),
      ).toEqual([]);
    });
    it('merges restored identities without replacing existing rows', async () => {
      const testDb = getTestDb();
      const existingNovelId = await insertTestNovel(testDb, {
        path: '/restore/merge',
        pluginId: 'merge-plugin',
        name: 'Before Restore',
        cover: 'before-cover',
        summary: 'before-summary',
        author: 'Before Author',
        artist: 'Before Artist',
        status: 'Paused',
        genres: 'before',
        inLibrary: false,
        isLocal: false,
        totalPages: 1,
      });
      const conflictingChapterId = await insertTestChapter(
        testDb,
        existingNovelId,
        {
          path: '/restore/merge/chapter',
          name: 'Before Chapter',
          bookmark: false,
          unread: true,
          readTime: '2023-01-01T00:00:00.000Z',
          isDownloaded: false,
          updatedTime: '2022-01-01T00:00:00.000Z',
          chapterNumber: 1,
          page: '1',
          position: 0,
          progress: 1,
          timeSpent: 2,
        },
      );
      const unrelatedChapterId = await insertTestChapter(
        testDb,
        existingNovelId,
        {
          path: '/restore/merge/unrelated',
          name: 'Unrelated Chapter',
          bookmark: false,
          unread: true,
          readTime: '2024-01-01T00:00:00.000Z',
          isDownloaded: false,
          updatedTime: '2024-01-01T00:00:00.000Z',
          chapterNumber: 2,
          page: '1',
          position: 1,
          progress: 0,
          timeSpent: 3,
        },
      );
      expect(existingNovelId).not.toBe(900);
      expect(conflictingChapterId).not.toBe(9001);

      const restoreRunId = 'restore-merge';
      const backupNovel = {
        id: 900,
        path: '/restore/merge',
        pluginId: 'merge-plugin',
        name: 'Restored Novel',
        cover: 'file:///mock/novel/storage/cache-key?size=large',
        summary: 'backup-summary',
        author: 'Backup Author',
        artist: 'Backup Artist',
        status: 'Completed',
        genres: 'backup',
        inLibrary: true,
        isLocal: true,
        totalPages: 123,
        chapters: [
          {
            id: 9001,
            novelId: 900,
            path: '/restore/merge/chapter',
            name: 'Restored Chapter',
            releaseTime: '2024-02-01T00:00:00.000Z',
            readTime: '2025-01-01T00:00:00.000Z',
            bookmark: true,
            unread: false,
            isDownloaded: true,
            updatedTime: '2026-01-01T00:00:00.000Z',
            chapterNumber: 10,
            page: '7',
            progress: 42,
            position: 4,
            scanlator: 'Backup Scanlator',
            timeSpent: 9,
          },
        ],
      };

      const firstMapping = await _restoreNovelAndChapters(backupNovel, {
        includeChapterMappings: true,
        restoreRunId,
      });
      expect(firstMapping).toEqual({
        pluginId: 'merge-plugin',
        backupNovelId: 900,
        restoredNovelId: existingNovelId,
      });

      const restoredNovel = await getNovelByPath(
        '/restore/merge',
        'merge-plugin',
      );
      expect(restoredNovel).toEqual(
        expect.objectContaining({
          id: existingNovelId,
          name: 'Restored Novel',
          cover: `file:///mock/novel/storage/merge-plugin/${existingNovelId}/cover.png?size=large`,
          summary: 'backup-summary',
          author: 'Backup Author',
          artist: 'Backup Artist',
          status: 'Completed',
          genres: 'backup',
          inLibrary: 1,
          isLocal: 1,
          totalPages: 123,
          totalChapters: 2,
          chaptersDownloaded: 1,
          chaptersUnread: 1,
          lastReadAt: '2025-01-01T00:00:00.000Z',
          lastUpdatedAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      const restoredChapters = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, existingNovelId))
        .all();
      expect(restoredChapters).toHaveLength(2);
      expect(
        restoredChapters.find(
          chapter => chapter.path === '/restore/merge/chapter',
        ),
      ).toEqual(
        expect.objectContaining({
          id: conflictingChapterId,
          novelId: existingNovelId,
          name: 'Restored Chapter',
          releaseTime: '2024-02-01T00:00:00.000Z',
          readTime: '2025-01-01T00:00:00.000Z',
          bookmark: true,
          unread: false,
          isDownloaded: true,
          updatedTime: '2026-01-01T00:00:00.000Z',
          chapterNumber: 10,
          page: '7',
          progress: 42,
          position: 4,
          scanlator: 'Backup Scanlator',
          timeSpent: 9,
        }),
      );
      expect(
        restoredChapters.find(
          chapter => chapter.path === '/restore/merge/unrelated',
        ),
      ).toEqual(
        expect.objectContaining({
          id: unrelatedChapterId,
          name: 'Unrelated Chapter',
        }),
      );

      expect(
        await getRestoreChapterMappings(restoreRunId, 900, [9001]),
      ).toEqual([
        {
          backupChapterId: 9001,
          restoredChapterId: conflictingChapterId,
        },
      ]);

      const secondMapping = await _restoreNovelAndChapters(backupNovel, {
        includeChapterMappings: true,
        restoreRunId,
      });
      expect(secondMapping.restoredNovelId).toBe(existingNovelId);
      const novelsAfterReplay = await testDb.drizzleDb
        .select()
        .from(novelSchema)
        .where(
          and(
            eq(novelSchema.path, '/restore/merge'),
            eq(novelSchema.pluginId, 'merge-plugin'),
          ),
        )
        .all();
      const chaptersAfterReplay = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, existingNovelId))
        .all();
      expect(novelsAfterReplay).toHaveLength(1);
      expect(chaptersAfterReplay).toHaveLength(2);
      expect(
        chaptersAfterReplay.map(chapter => chapter.id).sort((a, b) => a - b),
      ).toEqual(
        [conflictingChapterId, unrelatedChapterId].sort((a, b) => a - b),
      );

      await clearRestoreChapterMappings(restoreRunId);
      expect(
        await getRestoreChapterMappings(restoreRunId, 900, [9001]),
      ).toEqual([]);
      expect(
        testDb.sqlite.executeSync('PRAGMA foreign_key_check').rows,
      ).toEqual([]);
    });
  });
});
