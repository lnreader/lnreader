import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, insertTestChapter, clearAllTables } from './testData';
import { chapterSchema, novelSchema } from '@database/schema';
import { and, eq } from 'drizzle-orm';
import type { SQLBatchTuple } from '@op-engineering/op-sqlite';
import type { BackupNovel, ChapterInfo } from '../../types';

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

const createBackupChapter = (
  id: number,
  novelId: number,
  path: string,
  values: Partial<ChapterInfo> = {},
): ChapterInfo => ({
  id,
  novelId,
  path,
  name: `Chapter ${id}`,
  releaseTime: null,
  readTime: null,
  bookmark: false,
  unread: true,
  isDownloaded: false,
  updatedTime: null,
  chapterNumber: 1,
  page: '1',
  progress: null,
  position: 0,
  scanlator: null,
  timeSpent: 0,
  ...values,
});

const createBackupNovel = (
  id: number,
  path: string,
  chapters: ChapterInfo[] = [],
  pluginId = 'restore-plugin',
): BackupNovel => ({
  id,
  path,
  pluginId,
  name: `Novel ${id}`,
  cover: null,
  summary: null,
  author: null,
  artist: null,
  status: 'Unknown',
  genres: null,
  inLibrary: true,
  isLocal: false,
  totalPages: 0,
  chapters,
});

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
    it('reports a completed chapter checkpoint for a batch with no chapters', async () => {
      const progress: {
        stage: 'novels' | 'chapters' | 'stats';
        completed: number;
        total: number;
      }[] = [];
      const mappings = await _restoreNovelsAndChapters(
        [
          createBackupNovel(1, '/empty/one'),
          createBackupNovel(2, '/empty/two'),
        ],
        {
          includeChapterMappings: false,
          onProgress: checkpoint => progress.push(checkpoint),
        },
      );

      expect(mappings).toHaveLength(2);
      expect(progress).toEqual([
        { stage: 'novels', completed: 2, total: 2 },
        { stage: 'chapters', completed: 0, total: 0 },
        { stage: 'stats', completed: 0, total: 2 },
        { stage: 'stats', completed: 2, total: 2 },
      ]);
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
    it('restores 101 novels across a full statement and tail', async () => {
      const testDb = getTestDb();
      const unrelatedNovelId = await insertTestNovel(testDb, {
        path: '/collision/unrelated',
        pluginId: 'unrelated-plugin',
        name: 'Unrelated Novel',
      });
      const matchingNovelId = await insertTestNovel(testDb, {
        path: '/bulk/novel-1',
        pluginId: 'restore-plugin',
        name: 'Before Restore',
      });
      const firstNovelChapters = [
        createBackupChapter(51_001, 1, '/bulk/chapter-1-1', {
          updatedTime: '2024-02-01T00:00:00.000Z',
        }),
        createBackupChapter(51_002, 1, '/bulk/chapter-1-2', {
          updatedTime: '2024-02-01 01:00:00',
        }),
      ];
      const backupNovels = Array.from({ length: 101 }, (_, index) =>
        createBackupNovel(
          index + 1,
          `/bulk/novel-${index + 1}`,
          index === 0 ? firstNovelChapters : [],
        ),
      );

      const progress: {
        stage: 'novels' | 'chapters' | 'stats';
        completed: number;
        total: number;
      }[] = [];
      const mappings = await _restoreNovelsAndChapters(backupNovels, {
        restoreRunId: 'restore-101-novels',
        onProgress: checkpoint => progress.push(checkpoint),
      });
      expect(progress.filter(({ stage }) => stage === 'novels')).toEqual([
        { stage: 'novels', completed: 100, total: 101 },
        { stage: 'novels', completed: 101, total: 101 },
      ]);
      expect(progress.filter(({ stage }) => stage === 'chapters')).toEqual([
        { stage: 'chapters', completed: 2, total: 2 },
      ]);
      expect(progress.filter(({ stage }) => stage === 'stats')).toEqual([
        { stage: 'stats', completed: 0, total: 101 },
        { stage: 'stats', completed: 101, total: 101 },
      ]);

      expect(mappings.map(mapping => mapping.backupNovelId)).toEqual(
        Array.from({ length: 101 }, (_, index) => index + 1),
      );
      expect(mappings[0].restoredNovelId).toBe(matchingNovelId);
      expect(mappings[0].restoredNovelId).not.toBe(unrelatedNovelId);
      const restoredNovels = await testDb.drizzleDb
        .select()
        .from(novelSchema)
        .all();
      const restoredIdsByIdentity = new Map(
        restoredNovels.map(novel => [
          `${novel.pluginId}\u0000${novel.path}`,
          novel.id,
        ]),
      );
      expect(
        mappings.map(mapping =>
          restoredIdsByIdentity.get(
            `restore-plugin\u0000/bulk/novel-${mapping.backupNovelId}`,
          ),
        ),
      ).toEqual(mappings.map(mapping => mapping.restoredNovelId));
      expect(
        await getNovelByPath('/collision/unrelated', 'unrelated-plugin'),
      ).toEqual(
        expect.objectContaining({
          id: unrelatedNovelId,
          name: 'Unrelated Novel',
        }),
      );
      expect(await getNovelByPath('/bulk/novel-1', 'restore-plugin')).toEqual(
        expect.objectContaining({
          totalChapters: 2,
          lastUpdatedAt: '2024-02-01 01:00:00',
        }),
      );
      expect(await getNovelByPath('/bulk/novel-101', 'restore-plugin')).toEqual(
        expect.objectContaining({ totalChapters: 0 }),
      );
    });
    it('reports each completed 10,000-chapter database chunk', async () => {
      const progress: {
        stage: 'novels' | 'chapters' | 'stats';
        completed: number;
        total: number;
      }[] = [];
      const chapters = Array.from({ length: 10_001 }, (_, index) =>
        createBackupChapter(
          index + 1,
          1,
          `/restore/checkpoints/chapter-${index + 1}`,
        ),
      );

      const [mapping] = await _restoreNovelsAndChapters(
        [createBackupNovel(1, '/restore/checkpoints', chapters)],
        {
          includeChapterMappings: false,
          onProgress: checkpoint => progress.push(checkpoint),
        },
      );

      expect(progress.filter(({ stage }) => stage === 'chapters')).toEqual([
        { stage: 'chapters', completed: 10_000, total: 10_001 },
        { stage: 'chapters', completed: 10_001, total: 10_001 },
      ]);
      expect(
        await getNovelByPath('/restore/checkpoints', 'restore-plugin'),
      ).toEqual(expect.objectContaining({ totalChapters: 10_001 }));
      const persistedChapters = await getTestDb()
        .drizzleDb.select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, mapping.restoredNovelId))
        .all();
      expect(persistedChapters).toHaveLength(10_001);
    });
    it('restores 201 chapters with stable identities and ordered mappings', async () => {
      const testDb = getTestDb();
      const restoredNovelId = await insertTestNovel(testDb, {
        path: '/restore/large',
        pluginId: 'large-plugin',
        name: 'Before Restore',
      });
      const stableChapterId = await insertTestChapter(testDb, restoredNovelId, {
        path: '/restore/large/chapter-0',
        name: 'Before Chapter',
        readTime: '2023-01-01T00:00:00.000Z',
        updatedTime: '2022-01-01T00:00:00.000Z',
      });
      const existingOnlyChapterId = await insertTestChapter(
        testDb,
        restoredNovelId,
        {
          path: '/restore/large/existing-only',
          name: 'Existing Only',
          readTime: '2024-01-01T00:00:00.000Z',
          updatedTime: '2023-01-01T00:00:00.000Z',
        },
      );
      const chapters = Array.from({ length: 201 }, (_, index) => {
        const backupChapterId =
          index === 1 || index === 2
            ? 7000
            : index === 99 || index === 100
            ? 8000
            : 10_000 + index;
        return createBackupChapter(
          backupChapterId,
          999,
          `/restore/large/chapter-${index}`,
          {
            unread: index % 2 === 0,
            isDownloaded: index % 3 === 0,
            ...(index === 0
              ? {
                  name: 'Restored Chapter',
                  releaseTime: '2024-03-01T00:00:00.000Z',
                  readTime: '2025-01-01T00:00:00.000Z',
                  bookmark: true,
                  updatedTime: '2024-02-01T00:00:00.000Z',
                  chapterNumber: 10,
                  page: '8',
                  progress: 45,
                  position: 7,
                  scanlator: 'Backup Scanlator',
                  timeSpent: 12,
                }
              : {}),
            ...(index === 1 ? { updatedTime: '2024-02-01 01:00:00' } : {}),
            ...(index === 2 ? { name: 'Same Statement Last' } : {}),
            ...(index === 100 ? { name: 'Across Boundary Last' } : {}),
          },
        );
      });
      const backupNovel = createBackupNovel(
        999,
        '/restore/large',
        chapters,
        'large-plugin',
      );
      const progress: {
        stage: 'novels' | 'chapters' | 'stats';
        completed: number;
        total: number;
      }[] = [];
      const options = {
        restoreRunId: 'restore-large',
        includeChapterMappings: true,
        onProgress: (checkpoint: (typeof progress)[number]) =>
          progress.push(checkpoint),
      };

      const firstMapping = await _restoreNovelAndChapters(backupNovel, options);
      expect(progress).toEqual([
        { stage: 'novels', completed: 1, total: 1 },
        { stage: 'chapters', completed: 201, total: 201 },
        { stage: 'stats', completed: 0, total: 1 },
        { stage: 'stats', completed: 1, total: 1 },
      ]);
      expect(firstMapping.restoredNovelId).toBe(restoredNovelId);

      const restoredChapters = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, restoredNovelId))
        .all();
      expect(restoredChapters).toHaveLength(202);
      const chaptersByPath = new Map(
        restoredChapters.map(chapter => [chapter.path, chapter]),
      );
      expect(chaptersByPath.get('/restore/large/chapter-0')).toEqual(
        expect.objectContaining({
          id: stableChapterId,
          name: 'Restored Chapter',
          releaseTime: '2024-03-01T00:00:00.000Z',
          readTime: '2025-01-01T00:00:00.000Z',
          bookmark: true,
          unread: true,
          isDownloaded: true,
          updatedTime: '2024-02-01T00:00:00.000Z',
          chapterNumber: 10,
          page: '8',
          progress: 45,
          position: 7,
          scanlator: 'Backup Scanlator',
          timeSpent: 12,
        }),
      );
      expect(chaptersByPath.get('/restore/large/existing-only')).toEqual(
        expect.objectContaining({
          id: existingOnlyChapterId,
          name: 'Existing Only',
        }),
      );
      const mappingRows = await getRestoreChapterMappings(
        'restore-large',
        999,
        [10_000, 7000, 8000],
      );
      expect(mappingRows).toHaveLength(3);
      const mappingsByBackupId = new Map(
        mappingRows.map(row => [row.backupChapterId, row]),
      );
      expect(mappingsByBackupId.get(10_000)?.restoredChapterId).toBe(
        stableChapterId,
      );
      expect(mappingsByBackupId.get(7000)?.restoredChapterId).toBe(
        chaptersByPath.get('/restore/large/chapter-2')?.id,
      );
      expect(mappingsByBackupId.get(8000)?.restoredChapterId).toBe(
        chaptersByPath.get('/restore/large/chapter-100')?.id,
      );
      expect(await getNovelByPath('/restore/large', 'large-plugin')).toEqual(
        expect.objectContaining({
          totalChapters: 202,
          chaptersDownloaded: 67,
          chaptersUnread: 102,
          lastReadAt: '2025-01-01T00:00:00.000Z',
          lastUpdatedAt: '2024-02-01 01:00:00',
        }),
      );

      await _restoreNovelAndChapters(backupNovel, options);

      const chaptersAfterReplay = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, restoredNovelId))
        .all();
      expect(chaptersAfterReplay).toHaveLength(202);
      expect(
        chaptersAfterReplay.map(chapter => chapter.id).sort((a, b) => a - b),
      ).toEqual(
        restoredChapters.map(chapter => chapter.id).sort((a, b) => a - b),
      );
      expect(
        await getRestoreChapterMappings('restore-large', 999, [7000, 8000]),
      ).toEqual(
        expect.arrayContaining([
          {
            backupChapterId: 7000,
            restoredChapterId: chaptersByPath.get('/restore/large/chapter-2')
              ?.id,
          },
          {
            backupChapterId: 8000,
            restoredChapterId: chaptersByPath.get('/restore/large/chapter-100')
              ?.id,
          },
        ]),
      );
      expect(
        testDb.sqlite.executeSync('PRAGMA foreign_key_check').rows,
      ).toEqual([]);
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
    it('requires a run ID when chapter mappings are enabled', async () => {
      const backupNovel = createBackupNovel(1, '/restore/missing-run', [
        createBackupChapter(10, 1, '/restore/missing-run/chapter'),
      ]);

      await expect(_restoreNovelAndChapters(backupNovel)).rejects.toThrow(
        'Restore run ID is required for chapter mappings',
      );
      expect(
        await getNovelByPath('/restore/missing-run', 'restore-plugin'),
      ).toBeUndefined();
    });
    it('falls back after a failed chapter batch and restores triggers', async () => {
      const testDb = getTestDb();
      const restoredNovelId = await insertTestNovel(testDb, {
        path: '/restore/fallback',
        pluginId: 'fallback-plugin',
        name: 'Before Restore',
      });
      const existingChapterId = await insertTestChapter(
        testDb,
        restoredNovelId,
        {
          path: '/restore/fallback/existing',
          name: 'Before Existing',
        },
      );
      const backupNovel = createBackupNovel(
        40,
        '/restore/fallback',
        [
          createBackupChapter(4001, 40, '/restore/fallback/existing', {
            name: 'Restored Existing',
          }),
          createBackupChapter(4002, 40, '/restore/fallback/new', {
            name: 'New Chapter',
          }),
        ],
        'fallback-plugin',
      );
      const executeBatch = testDb.dbManager.executeBatch.bind(testDb.dbManager);
      let batchFailureInjected = false;
      let triggersRestoredAfterRollback = false;
      const executeBatchSpy = jest
        .spyOn(testDb.dbManager, 'executeBatch')
        .mockImplementation(async commands => {
          if (
            !batchFailureInjected &&
            commands.some(([sql]) =>
              sql.includes('DROP TRIGGER IF EXISTS update_novel_stats'),
            )
          ) {
            batchFailureInjected = true;
            const failedCommands = commands.slice();
            failedCommands.splice(3, 0, [
              'INSERT INTO MissingRestoreTable VALUES (1)',
            ] as SQLBatchTuple);
            try {
              return await executeBatch(failedCommands);
            } catch (error) {
              const triggerRows = testDb.sqlite.executeSync(
                `SELECT name FROM sqlite_master
                 WHERE type = 'trigger'
                   AND name IN (
                     'update_novel_stats',
                     'update_novel_stats_on_update',
                     'update_novel_stats_on_delete'
                   )`,
              ).rows;
              triggersRestoredAfterRollback = triggerRows.length === 3;
              throw error;
            }
          }
          return executeBatch(commands);
        });

      try {
        await _restoreNovelAndChapters(backupNovel, {
          restoreRunId: 'restore-fallback',
        });
      } finally {
        executeBatchSpy.mockRestore();
      }

      expect(batchFailureInjected).toBe(true);
      expect(triggersRestoredAfterRollback).toBe(true);
      const restoredChapters = await testDb.drizzleDb
        .select()
        .from(chapterSchema)
        .where(eq(chapterSchema.novelId, restoredNovelId))
        .all();
      expect(restoredChapters).toHaveLength(2);
      expect(
        restoredChapters.find(
          chapter => chapter.path === '/restore/fallback/existing',
        )?.id,
      ).toBe(existingChapterId);
      expect(
        await getRestoreChapterMappings('restore-fallback', 40, [4001, 4002]),
      ).toHaveLength(2);

      await insertTestChapter(testDb, restoredNovelId, {
        path: '/restore/fallback/trigger-check',
      });
      expect(
        await getNovelByPath('/restore/fallback', 'fallback-plugin'),
      ).toEqual(expect.objectContaining({ totalChapters: 3 }));
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
