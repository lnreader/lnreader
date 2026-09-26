import {
  clearRestoreChapterMappings,
  _restoreNovelAndChapters,
  _restoreNovelsAndChapters,
} from '@database/queries/NovelRestoreQueries';
import { getAllNovels } from '@database/queries/NovelQueries';
import { getAllNovelChaptersForBackup } from '@database/queries/ChapterQueries';
import {
  _restoreCategory,
  getAllNovelCategories,
  getCategoriesFromDb,
} from '@database/queries/CategoryQueries';
import NativeFile from '@modules/native-file';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import {
  clearRestoreChapterMappingsSafely,
  prepareBackupData,
  restoreData,
} from '../utils';
import { decodeNovelBatch, encodeNovelBatch } from '../novelPayload';
import type {
  BackupNovel,
  ChapterInfo,
  RestoredNovelMapping,
} from '@database/types';
import type { BackupOptions } from '../options';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';

jest.mock('@database/queries/NovelQueries', () => ({
  getAllNovels: jest.fn(),
}));

jest.mock('@database/queries/NovelRestoreQueries', () => ({
  clearRestoreChapterMappings: jest.fn(async () => undefined),
  _restoreNovelAndChapters: jest.fn(),
  _restoreNovelsAndChapters: jest.fn(),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getAllNovelChaptersForBackup: jest.fn(),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  _restoreCategory: jest.fn(),
  getAllNovelCategories: jest.fn(),
  getCategoriesFromDb: jest.fn(),
}));

jest.mock('@hooks/persisted/useSelfHost', () => ({
  SELF_HOST_BACKUP: 'SELF_HOST_BACKUP',
}));

jest.mock('@hooks/persisted/migrations/trackerMigration', () => ({
  OLD_TRACKED_NOVEL_PREFIX: 'OLD_TRACKED_NOVEL_PREFIX',
}));

jest.mock('@hooks/persisted/useUpdates', () => ({
  LAST_UPDATE_TIME: 'LAST_UPDATE_TIME',
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    getAllKeys: jest.fn(() => []),
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@plugins/pluginManager', () => ({
  INSTALLED_PLUGINS_KEY: 'INSTALL_PLUGINS',
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  ROOT_STORAGE: '/storage',
}));

const pluginOnlyOptions: BackupOptions = {
  library: false,
  settings: false,
  plugins: true,
  downloadedFiles: false,
};
const makeTestChapter = (novelId: number, chapterNumber = 1): ChapterInfo => ({
  id: novelId * 100 + chapterNumber,
  novelId,
  path: `/novel/${novelId}/chapter/${chapterNumber}`,
  name: `Chapter ${chapterNumber}`,
  releaseTime: `2024-01-${String(chapterNumber).padStart(2, '0')}`,
  readTime: null,
  bookmark: chapterNumber % 2 === 0,
  unread: chapterNumber % 2 !== 0,
  isDownloaded: true,
  updatedTime: `2024-02-${String(chapterNumber).padStart(2, '0')}`,
  chapterNumber,
  page: String(chapterNumber),
  position: chapterNumber - 1,
  progress: chapterNumber / 10,
  scanlator: `scanlator-${chapterNumber}`,
  timeSpent: chapterNumber * 60,
});

const makeTestNovel = (
  id: number,
  pluginId = 'source',
  chapters = [makeTestChapter(id)],
): BackupNovel => ({
  id,
  name: `Novel ${id}`,
  path: `/novel/${id}`,
  pluginId,
  cover: null,
  summary: `Summary ${id}`,
  author: `Author ${id}`,
  artist: `Artist ${id}`,
  status: 'ongoing',
  genres: 'fantasy',
  inLibrary: true,
  isLocal: false,
  totalPages: 100,
  chapters,
});

describe('selective backup data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(NativeFile.exists).mockResolvedValue(false);
    jest.mocked(NativeFile.mkdir).mockResolvedValue(undefined);
    jest.mocked(NativeFile.writeFile).mockResolvedValue(undefined);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(getAllNovels).mockResolvedValue([]);
    jest.mocked(getAllNovelChaptersForBackup).mockResolvedValue([]);
    jest.mocked(getCategoriesFromDb).mockResolvedValue([]);
    jest.mocked(getAllNovelCategories).mockResolvedValue([]);
    const restoreNovel = async (
      novel: BackupNovel,
      _options?: { includeChapterMappings?: boolean; restoreRunId?: string },
    ): Promise<RestoredNovelMapping> => ({
      pluginId: novel.pluginId,
      backupNovelId: novel.id,
      restoredNovelId: novel.id,
    });
    jest.mocked(_restoreNovelAndChapters).mockImplementation(restoreNovel);
    jest.mocked(_restoreNovelsAndChapters).mockImplementation(
      async (
        novels: BackupNovel[],
        _options?: {
          includeChapterMappings?: boolean;
          restoreRunId?: string;
        },
      ) => Promise.all(novels.map(novel => restoreNovel(novel, _options))),
    );
  });

  it('writes the selected sections to the v2 manifest', async () => {
    await prepareBackupData('/cache', pluginOnlyOptions);

    expect(NativeFile.writeFile).toHaveBeenCalledTimes(2);
    expect(NativeFile.writeFile).toHaveBeenCalledWith(
      '/cache/Version.json',
      expect.stringContaining(
        '"sections":{"library":false,"settings":false,"plugins":true,"downloadedFiles":false}',
      ),
    );
    expect(getAllNovels).not.toHaveBeenCalled();
    expect(getCategoriesFromDb).not.toHaveBeenCalled();
    expect(NativeFile.writeFile).toHaveBeenCalledWith(
      '/cache/Plugins.json',
      '[]',
    );
  });

  it('accepts v3 section manifests', async () => {
    const options: BackupOptions = {
      library: false,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    };
    jest.mocked(NativeFile.readFile).mockResolvedValueOnce(
      JSON.stringify({
        appVersion: '2.1.3',
        formatVersion: 3,
        sections: options,
      }),
    );

    const result = await restoreData('/cache');

    expect(result.manifest).toEqual({
      appVersion: '2.1.3',
      formatVersion: 3,
      sections: options,
    });
    expect(result.restoreRunId).toEqual(expect.any(String));
  });

  it('does not warn about sections intentionally omitted by the manifest', async () => {
    jest
      .mocked(NativeFile.readFile)
      .mockResolvedValueOnce(
        JSON.stringify({
          appVersion: '2.1.0',
          formatVersion: 2,
          sections: pluginOnlyOptions,
        }),
      )
      .mockResolvedValueOnce('[]');
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path.endsWith('/Plugins.json'));

    const result = await restoreData('/cache');

    expect(result).toMatchObject({
      restoreRunId: expect.any(String),
      failedNovelCount: 0,
      failedCategoryCount: 0,
      failedSectionCount: 0,
      settingsRestored: true,
      manifest: {
        formatVersion: 2,
        sections: pluginOnlyOptions,
      },
    });
    expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
    expect(_restoreCategory).not.toHaveBeenCalled();
    expect(MMKVStorage.set).toHaveBeenCalledWith('INSTALL_PLUGINS', '[]');
  });

  it('merges restored plugins with the existing registry', async () => {
    const options: BackupOptions = {
      library: false,
      settings: true,
      plugins: true,
      downloadedFiles: false,
    };
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(
        async path =>
          path.endsWith('/Version.json') ||
          path.endsWith('/Setting.json') ||
          path.endsWith('/Plugins.json'),
      );
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.0',
          formatVersion: 2,
          sections: options,
        });
      }
      if (path.endsWith('/Setting.json')) {
        return JSON.stringify({
          INSTALL_PLUGINS: JSON.stringify([
            { id: 'restored', name: 'Restored' },
          ]),
          THEME: 'dark',
        });
      }
      return JSON.stringify([{ id: 'restored', name: 'Restored' }]);
    });
    jest
      .mocked(MMKVStorage.getString)
      .mockReturnValueOnce(
        JSON.stringify([{ id: 'existing', name: 'Existing' }]),
      );

    await restoreData('/cache');

    expect(MMKVStorage.set).toHaveBeenCalledWith('THEME', 'dark');
    expect(MMKVStorage.set).toHaveBeenCalledWith(
      'INSTALL_PLUGINS',
      JSON.stringify([
        { id: 'existing', name: 'Existing' },
        { id: 'restored', name: 'Restored' },
      ]),
    );
  });

  it('merges the plugin registry from legacy settings', async () => {
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path.endsWith('/Setting.json'));
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({ version: '2.0.0' });
      }
      return JSON.stringify({
        INSTALL_PLUGINS: JSON.stringify([{ id: 'legacy', name: 'Legacy' }]),
      });
    });
    jest
      .mocked(MMKVStorage.getString)
      .mockReturnValueOnce(
        JSON.stringify([{ id: 'existing', name: 'Existing' }]),
      );

    await restoreData('/cache');

    expect(MMKVStorage.set).toHaveBeenCalledWith(
      'INSTALL_PLUGINS',
      JSON.stringify([
        { id: 'existing', name: 'Existing' },
        { id: 'legacy', name: 'Legacy' },
      ]),
    );
  });

  it('includes stored covers with library data when downloads are omitted', async () => {
    jest.mocked(getAllNovels).mockResolvedValueOnce([
      {
        ...makeTestNovel(1),
        cover: 'file:///storage/Novels/source/1/cover.png?123',
      },
    ]);
    jest.mocked(getAllNovelChaptersForBackup).mockResolvedValueOnce([
      {
        ...makeTestChapter(1),
        id: 10,
      },
    ]);
    await prepareBackupData('/cache', {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    });

    const novelWrite = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.find(([path]) =>
        path.endsWith('/NovelAndChapters/batch-000001.json'),
      );
    const compactNovel = JSON.parse(novelWrite?.[1] ?? '[]')[0];
    expect(compactNovel).toMatchObject({
      id: 1,
      co: '/Novels/source/1/cover.png?123',
    });
    expect(compactNovel.c).toHaveLength(1);
    expect(compactNovel.c[0]).toHaveLength(15);
    expect(compactNovel.c[0][0]).toBe(10);
    expect(compactNovel.c[0][7]).toBe(false);
    expect(NativeFile.copyFile).toHaveBeenCalledWith(
      'file:///storage/Novels/source/1/cover.png',
      '/cache/Covers/1',
    );
  });

  it('does not duplicate covers when downloaded files are included', async () => {
    jest.mocked(getAllNovels).mockResolvedValueOnce([
      {
        ...makeTestNovel(1),
        cover: 'file:///storage/Novels/source/1/cover.png?123',
      },
    ]);

    jest.mocked(NativeFile.copyFile).mockClear();
    jest.mocked(NativeFile.mkdir).mockClear();

    await prepareBackupData('/cache', {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: true,
    });

    const novelWrite = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.find(([path]) =>
        path.endsWith('/NovelAndChapters/batch-000001.json'),
      );
    const compactNovel = JSON.parse(novelWrite?.[1] ?? '[]')[0];
    expect(compactNovel).toMatchObject({
      id: 1,
      co: '/Novels/source/1/cover.png?123',
    });

    expect(NativeFile.copyFile).not.toHaveBeenCalledWith(
      'file:///storage/Novels/source/1/cover.png',
      '/cache/Covers/1',
    );
    expect(NativeFile.mkdir).not.toHaveBeenCalledWith('/cache/Covers');
  });

  it('round-trips a fully populated novel through the compact codec', () => {
    const novel: BackupNovel & {
      chaptersDownloaded: number;
      chaptersUnread: number;
      totalChapters: number;
      lastReadAt: string;
      lastUpdatedAt: string;
    } = {
      id: 7,
      name: 'The Compact Novel',
      path: '/novels/compact',
      pluginId: 'source',
      cover: '/covers/compact.png?cache=1',
      summary: null,
      author: 'Author',
      artist: null,
      status: 'ongoing',
      genres: null,
      inLibrary: null,
      isLocal: false,
      totalPages: 2048,
      chaptersDownloaded: 1,
      chaptersUnread: 1,
      totalChapters: 2,
      lastReadAt: '2024-03-01T10:20:30.000Z',
      lastUpdatedAt: '2024-03-02T10:20:30.000Z',
      chapters: [
        {
          id: 701,
          novelId: 7,
          path: '/novels/compact/1',
          name: 'First chapter',
          releaseTime: '2024-01-01T00:00:00.000Z',
          readTime: '2024-03-01T10:00:00.000Z',
          bookmark: true,
          unread: false,
          isDownloaded: true,
          updatedTime: '2024-02-01T00:00:00.000Z',
          chapterNumber: 1,
          page: '4',
          position: 2,
          progress: 0.75,
          scanlator: 'Team A',
          timeSpent: 90,
        },
        {
          id: 702,
          novelId: 7,
          path: '/novels/compact/2',
          name: 'Second chapter',
          releaseTime: null,
          readTime: null,
          bookmark: null,
          unread: true,
          isDownloaded: false,
          updatedTime: null,
          chapterNumber: null,
          page: null,
          position: null,
          progress: null,
          scanlator: null,
          timeSpent: null,
        },
      ],
    };

    const [compactNovel] = encodeNovelBatch([novel]);

    expect(Object.keys(compactNovel).sort()).toEqual(
      [
        'c',
        'id',
        'p',
        'pi',
        'n',
        'co',
        's',
        'a',
        'ar',
        'st',
        'g',
        'l',
        'lo',
        't',
        'd',
        'u',
        'tc',
        'lr',
        'lu',
      ].sort(),
    );
    expect(compactNovel).toMatchObject({
      id: 7,
      p: '/novels/compact',
      pi: 'source',
      n: 'The Compact Novel',
      co: '/covers/compact.png?cache=1',
      d: 1,
      u: 1,
      tc: 2,
      lr: '2024-03-01T10:20:30.000Z',
      lu: '2024-03-02T10:20:30.000Z',
    });
    expect(compactNovel.c).toEqual([
      [
        701,
        '/novels/compact/1',
        'First chapter',
        '2024-01-01T00:00:00.000Z',
        true,
        false,
        '2024-03-01T10:00:00.000Z',
        true,
        '2024-02-01T00:00:00.000Z',
        1,
        '4',
        2,
        0.75,
        'Team A',
        90,
      ],
      [
        702,
        '/novels/compact/2',
        'Second chapter',
        null,
        null,
        true,
        null,
        false,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    ]);
    expect(Object.keys(compactNovel.c[0])).not.toContain('novelId');
    expect(compactNovel).not.toHaveProperty('chapters');

    expect(decodeNovelBatch([compactNovel])).toEqual([novel]);
  });

  it('writes 101 novels as ordered compact batches with a format marker', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: true,
    };
    const novels = Array.from({ length: 101 }, (_, index) => {
      const id = index + 1;
      return makeTestNovel(id, 'source', [
        makeTestChapter(id, 1),
        makeTestChapter(id, 2),
      ]);
    });
    jest.mocked(getAllNovels).mockResolvedValueOnce(novels);
    jest.mocked(getAllNovelChaptersForBackup).mockImplementation(async ids => {
      const requestedIds = Array.isArray(ids) ? ids : [ids];
      return novels
        .flatMap(novel => novel.chapters)
        .filter(chapter => requestedIds.includes(chapter.novelId));
    });

    await prepareBackupData('/cache', options);

    const batchWrites = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.filter(([path]) => path.includes('/NovelAndChapters/batch-'));
    expect(batchWrites.map(([path]) => path)).toEqual([
      '/cache/NovelAndChapters/batch-000001.json',
      '/cache/NovelAndChapters/batch-000002.json',
    ]);
    expect(batchWrites.some(([path]) => /\/\d+\.json$/.test(path))).toBe(false);

    const batches = batchWrites.map(([, content]) => JSON.parse(content));
    expect(batches.map(batch => batch.length)).toEqual([100, 1]);
    const records = batches.flat();
    expect(records.map(record => record.id)).toEqual(
      novels.map(novel => novel.id),
    );
    expect(
      records.map(record =>
        record.c.map((chapter: [number, ...unknown[]]) => chapter[0]),
      ),
    ).toEqual(novels.map(novel => novel.chapters.map(chapter => chapter.id)));
    expect(
      records.every(
        record =>
          Array.isArray(record.c) &&
          record.c.every((chapter: unknown[]) => chapter.length === 15),
      ),
    ).toBe(true);

    const manifestWrite = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.find(([path]) => path.endsWith('/Version.json'));
    expect(JSON.parse(manifestWrite?.[1] ?? '{}')).toMatchObject({
      formatVersion: 2,
      novelDataFormat: 2,
    });
  });

  it('restores stored covers from library data and preserves missing covers', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    };
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.2',
          formatVersion: 2,
          sections: options,
        });
      }
      if (path.endsWith('/1.json')) {
        return JSON.stringify({
          id: 1,
          name: 'Stored cover',
          path: '/stored-cover',
          pluginId: 'source',
          cover: '/Novels/source/1/cover.png?123',
          chapters: [],
        });
      }
      if (path.endsWith('/2.json')) {
        return JSON.stringify({
          id: 2,
          name: 'Missing cover',
          path: '/missing-cover',
          pluginId: 'source',
          cover: null,
          chapters: [],
        });
      }
      return '[]';
    });
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path =>
        [
          '/cache/NovelAndChapters',
          '/cache/Covers/1',
          '/cache/Category.json',
        ].includes(path),
      );
    jest.mocked(NativeFile.readDir).mockResolvedValue([
      {
        name: '1.json',
        path: '/cache/NovelAndChapters/1.json',
        isDirectory: false,
      },
      {
        name: '2.json',
        path: '/cache/NovelAndChapters/2.json',
        isDirectory: false,
      },
    ]);

    await restoreData('/cache');

    expect(NativeFile.copyFile).toHaveBeenCalledWith(
      '/cache/Covers/1',
      '/storage/Novels/source/1/cover.png',
    );
    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 1,
          cover: 'file:///storage/Novels/source/1/cover.png?123',
        }),
        expect.objectContaining({ id: 2, cover: null }),
      ],
      { includeChapterMappings: false },
    );
    expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
  });

  it('keeps restored mappings when a stored cover copy fails', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    };
    const novels = [1, 2, 3].map(id => ({
      ...makeTestNovel(id),
      cover: `/Novels/source/${id}/cover.png`,
    }));
    const mappings: RestoredNovelMapping[] = novels.map(novel => ({
      pluginId: novel.pluginId,
      backupNovelId: novel.id,
      restoredNovelId: novel.id + 100,
    }));
    const category = { id: 1, name: 'Category', novelIds: [1, 2, 3] };

    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path =>
        [
          '/cache/NovelAndChapters',
          '/cache/Covers/1',
          '/cache/Covers/2',
          '/cache/Covers/3',
          '/cache/Category.json',
        ].includes(path),
      );
    jest.mocked(NativeFile.readDir).mockResolvedValue(
      novels.map(novel => ({
        name: `${novel.id}.json`,
        path: `/cache/NovelAndChapters/${novel.id}.json`,
        isDirectory: false,
      })),
    );
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          sections: options,
        });
      }
      if (path.endsWith('/Category.json')) {
        return JSON.stringify([category]);
      }
      const novel = novels.find(item => path.endsWith(`/${item.id}.json`));
      if (!novel) {
        throw new Error(`Unexpected read: ${path}`);
      }
      return JSON.stringify(novel);
    });
    jest.mocked(_restoreNovelsAndChapters).mockResolvedValueOnce(mappings);
    jest.mocked(NativeFile.copyFile).mockImplementation(async source => {
      if (source === '/cache/Covers/1') {
        throw new Error('Cover copy failed');
      }
    });

    const result = await restoreData('/cache');

    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(
      novels.map(novel => ({
        ...novel,
        cover: `file:///storage${novel.cover}`,
      })),
      { includeChapterMappings: false },
    );
    expect(NativeFile.copyFile).toHaveBeenCalledWith(
      '/cache/Covers/2',
      '/storage/Novels/source/102/cover.png',
    );
    expect(NativeFile.copyFile).toHaveBeenCalledWith(
      '/cache/Covers/3',
      '/storage/Novels/source/103/cover.png',
    );
    expect(_restoreCategory).toHaveBeenCalledWith(
      expect.objectContaining({ novelIds: [1, 2, 3] }),
      new Map([
        [1, 101],
        [2, 102],
        [3, 103],
      ]),
    );
    expect(result).toMatchObject({
      novelCount: 3,
      failedNovelCount: 1,
      failedSectionCount: 0,
      novelMappings: mappings,
    });
  });

  it('omits the installed-plugin registry when plugin files are excluded', async () => {
    jest
      .mocked(MMKVStorage.getAllKeys)
      .mockReturnValueOnce(['INSTALL_PLUGINS', 'OTHER_SETTING']);
    jest
      .mocked(MMKVStorage.getString)
      .mockImplementation(key =>
        key === 'INSTALL_PLUGINS'
          ? '[{"id":"source"}]'
          : key === 'OTHER_SETTING'
          ? 'kept'
          : undefined,
      );

    await prepareBackupData('/cache', {
      library: false,
      settings: true,
      plugins: false,
      downloadedFiles: false,
    });

    const settingsWrite = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.find(([path]) => path.endsWith('/Setting.json'));
    expect(JSON.parse(settingsWrite?.[1] ?? '{}')).toEqual({
      OTHER_SETTING: 'kept',
    });
  });

  it('restores downloaded-file novels in one mapping-aware batch', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: true,
    };
    const novels: BackupNovel[] = [
      {
        id: 11,
        name: 'First',
        path: '/first',
        pluginId: 'source',
        cover: null,
        summary: null,
        author: null,
        artist: null,
        status: null,
        genres: null,
        inLibrary: null,
        isLocal: null,
        totalPages: null,
        chapters: [
          {
            id: 101,
            novelId: 11,
            name: 'First chapter',
            path: '/first/1',
            releaseTime: null,
            readTime: null,
            bookmark: null,
            unread: null,
            isDownloaded: true,
            updatedTime: null,
            chapterNumber: null,
            page: null,
            position: null,
            progress: null,
            scanlator: null,
            timeSpent: 0,
          },
        ],
      },
      {
        id: 22,
        name: 'Second',
        path: '/second',
        pluginId: 'source',
        cover: null,
        summary: null,
        author: null,
        artist: null,
        status: null,
        genres: null,
        inLibrary: null,
        isLocal: null,
        totalPages: null,
        chapters: [
          {
            id: 202,
            novelId: 22,
            name: 'Second chapter',
            path: '/second/1',
            releaseTime: null,
            readTime: null,
            bookmark: null,
            unread: null,
            isDownloaded: true,
            updatedTime: null,
            chapterNumber: null,
            page: null,
            position: null,
            progress: null,
            scanlator: null,
            timeSpent: 0,
          },
        ],
      },
    ];
    const mappings: RestoredNovelMapping[] = [
      {
        pluginId: 'source',
        backupNovelId: 11,
        restoredNovelId: 111,
      },
      {
        pluginId: 'source',
        backupNovelId: 22,
        restoredNovelId: 222,
      },
    ];
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path === '/cache/NovelAndChapters');
    jest.mocked(NativeFile.readDir).mockResolvedValue(
      novels.map(novel => ({
        name: `${novel.id}.json`,
        path: `/cache/NovelAndChapters/${novel.id}.json`,
        isDirectory: false,
      })),
    );
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          sections: options,
        });
      }
      const novel = novels.find(item => path.endsWith(`/${item.id}.json`));
      return JSON.stringify(novel ?? {});
    });
    jest.mocked(_restoreNovelsAndChapters).mockResolvedValueOnce(mappings);

    const result = await restoreData('/cache');

    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(novels, {
      includeChapterMappings: true,
      restoreRunId: expect.any(String),
    });
    expect(result.restoreRunId).toBe(
      jest.mocked(_restoreNovelsAndChapters).mock.calls[0][1]?.restoreRunId,
    );
    expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      restoreRunId: expect.any(String),
      novelCount: 2,
      failedNovelCount: 0,
      novelMappings: mappings,
    });
  });
  it('reports validation and restore progress separately', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    };
    const novel = makeTestNovel(11);
    const mapping: RestoredNovelMapping = {
      pluginId: novel.pluginId,
      backupNovelId: novel.id,
      restoredNovelId: 111,
    };
    const progressTexts: string[] = [];
    const setMeta: TaskProgressUpdater = transform => {
      const next = transform({
        name: 'LOCAL_RESTORE',
        isRunning: true,
        progress: undefined,
        progressText: undefined,
      });
      if (next.progressText) {
        progressTexts.push(next.progressText);
      }
    };
    const benchmarkLog = jest.fn();

    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path === '/cache/NovelAndChapters');
    jest.mocked(NativeFile.readDir).mockResolvedValue([
      {
        name: '11.json',
        path: '/cache/NovelAndChapters/11.json',
        isDirectory: false,
      },
    ]);
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          sections: options,
        });
      }
      return JSON.stringify(novel);
    });
    jest.mocked(_restoreNovelsAndChapters).mockResolvedValueOnce([mapping]);

    await restoreData('/cache', setMeta, benchmarkLog);

    expect(progressTexts.slice(0, 4)).toEqual([
      'backupScreen.validatingNovels',
      'backupScreen.validatingNovelsProgress',
      'backupScreen.restoringNovels',
      'backupScreen.restoringNovelsProgress',
    ]);
    expect(benchmarkLog).toHaveBeenCalledWith(
      'restoreData:novels:validation:start',
    );
    expect(benchmarkLog).toHaveBeenCalledWith(
      'restoreData:novels:validation:done total=1',
    );
    expect(benchmarkLog).toHaveBeenCalledWith(
      'restoreData:novels:restore:start total=1',
    );
    expect(benchmarkLog).toHaveBeenCalledWith(
      'restoreData:novels:restore:progress current=1 total=1',
    );
  });

  it('restores scrambled compact batches in order with downloaded-file mappings', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: true,
    };
    const firstNovel = makeTestNovel(11, 'plugin-a', [makeTestChapter(11, 1)]);
    const secondNovel = makeTestNovel(22, 'plugin-b', [makeTestChapter(22, 1)]);
    const mappings: RestoredNovelMapping[] = [
      {
        pluginId: 'plugin-a',
        backupNovelId: 11,
        restoredNovelId: 111,
      },
      {
        pluginId: 'plugin-b',
        backupNovelId: 22,
        restoredNovelId: 222,
      },
    ];
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path === '/cache/NovelAndChapters');
    jest.mocked(NativeFile.readDir).mockResolvedValue([
      {
        name: 'batch-000002.json',
        path: '/cache/NovelAndChapters/batch-000002.json',
        isDirectory: false,
      },
      {
        name: 'ignored-directory',
        path: '/cache/NovelAndChapters/ignored-directory',
        isDirectory: true,
      },
      {
        name: 'batch-000001.json',
        path: '/cache/NovelAndChapters/batch-000001.json',
        isDirectory: false,
      },
    ]);
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          novelDataFormat: 2,
          sections: options,
        });
      }
      if (path.endsWith('/batch-000001.json')) {
        return JSON.stringify(encodeNovelBatch([firstNovel]));
      }
      if (path.endsWith('/batch-000002.json')) {
        return JSON.stringify(encodeNovelBatch([secondNovel]));
      }
      throw new Error(`Unexpected read: ${path}`);
    });
    jest.mocked(_restoreNovelsAndChapters).mockResolvedValueOnce(mappings);

    const result = await restoreData('/cache');

    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    const restoredNovels = jest.mocked(_restoreNovelsAndChapters).mock
      .calls[0][0] as BackupNovel[];
    expect(restoredNovels.map(novel => novel.id)).toEqual([11, 22]);
    expect(
      restoredNovels.map(novel =>
        novel.chapters.map(chapter => ({
          id: chapter.id,
          novelId: chapter.novelId,
          isDownloaded: chapter.isDownloaded,
        })),
      ),
    ).toEqual([
      [{ id: 1101, novelId: 11, isDownloaded: true }],
      [{ id: 2201, novelId: 22, isDownloaded: true }],
    ]);
    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(expect.any(Array), {
      includeChapterMappings: true,
      restoreRunId: expect.any(String),
    });
    expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      restoreRunId: expect.any(String),
      novelCount: 2,
      failedNovelCount: 0,
      pluginIds: ['plugin-a', 'plugin-b'],
      novelMappings: mappings,
    });
  });

  it('retries each downloaded-file novel when its batch restore fails', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: true,
    };
    const novels: BackupNovel[] = [
      {
        id: 31,
        name: 'First',
        path: '/first',
        pluginId: 'source',
        cover: null,
        summary: null,
        author: null,
        artist: null,
        status: null,
        genres: null,
        inLibrary: null,
        isLocal: null,
        totalPages: null,
        chapters: [],
      },
      {
        id: 32,
        name: 'Second',
        path: '/second',
        pluginId: 'source',
        cover: null,
        summary: null,
        author: null,
        artist: null,
        status: null,
        genres: null,
        inLibrary: null,
        isLocal: null,
        totalPages: null,
        chapters: [],
      },
    ];
    const mappings: RestoredNovelMapping[] = novels.map(novel => ({
      pluginId: novel.pluginId,
      backupNovelId: novel.id,
      restoredNovelId: novel.id + 100,
    }));
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path === '/cache/NovelAndChapters');
    jest.mocked(NativeFile.readDir).mockResolvedValue(
      novels.map(novel => ({
        name: `${novel.id}.json`,
        path: `/cache/NovelAndChapters/${novel.id}.json`,
        isDirectory: false,
      })),
    );
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          sections: options,
        });
      }
      const novel = novels.find(item => path.endsWith(`/${item.id}.json`));
      return JSON.stringify(novel ?? {});
    });
    jest
      .mocked(_restoreNovelsAndChapters)
      .mockRejectedValueOnce(new Error('batch failed'));
    jest.mocked(_restoreNovelAndChapters).mockImplementation(
      async (
        novel,
        _options?: {
          includeChapterMappings?: boolean;
          restoreRunId?: string;
        },
      ) => mappings.find(mapping => mapping.backupNovelId === novel.id)!,
    );

    const result = await restoreData('/cache');

    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(novels, {
      includeChapterMappings: true,
      restoreRunId: expect.any(String),
    });
    expect(_restoreNovelAndChapters).toHaveBeenNthCalledWith(1, novels[0], {
      includeChapterMappings: true,
      restoreRunId: expect.any(String),
    });
    expect(_restoreNovelAndChapters).toHaveBeenNthCalledWith(2, novels[1], {
      includeChapterMappings: true,
      restoreRunId: expect.any(String),
    });
    expect(result).toMatchObject({
      restoreRunId: expect.any(String),
      novelCount: 2,
      failedNovelCount: 0,
      novelMappings: mappings,
    });
  });

  it.each([
    {
      label: 'v1',
      manifest: { version: '1.0.0' },
      formatVersion: 1,
    },
    {
      label: 'v2',
      manifest: {
        appVersion: '2.0.0',
        formatVersion: 2,
        sections: {
          library: true,
          settings: false,
          plugins: false,
          downloadedFiles: true,
        },
      },
      formatVersion: 2,
    },
    {
      label: 'v3',
      manifest: {
        appVersion: '3.0.0',
        formatVersion: 3,
        sections: {
          library: true,
          settings: false,
          plugins: false,
          downloadedFiles: true,
        },
      },
      formatVersion: 3,
    },
  ])(
    '$label object payloads remain restorable',
    async ({ manifest, formatVersion }) => {
      const novel = makeTestNovel(301, 'legacy-source');
      jest
        .mocked(NativeFile.exists)
        .mockImplementation(async path => path === '/cache/NovelAndChapters');
      jest.mocked(NativeFile.readDir).mockResolvedValue([
        {
          name: 'legacy.json',
          path: '/cache/NovelAndChapters/legacy.json',
          isDirectory: false,
        },
      ]);
      jest.mocked(NativeFile.readFile).mockImplementation(async path => {
        if (path.endsWith('/Version.json')) {
          return JSON.stringify(manifest);
        }
        return JSON.stringify(novel);
      });

      const result = await restoreData('/cache');

      expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: 301,
            pluginId: 'legacy-source',
            chapters: [
              expect.objectContaining({
                id: 30101,
                novelId: 301,
              }),
            ],
          }),
        ],
        {
          includeChapterMappings: true,
          restoreRunId: expect.any(String),
        },
      );
      expect(result.manifest).toMatchObject({ formatVersion });
      expect(result).toMatchObject({
        restoreRunId: expect.any(String),
        novelCount: 1,
        failedNovelCount: 0,
        novelMappings: [
          expect.objectContaining({
            backupNovelId: 301,
            pluginId: 'legacy-source',
          }),
        ],
      });
    },
  );

  it('normalizes legacy object payloads before restoring them', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    };
    const legacyNovel = {
      id: 501,
      name: 'Legacy novel',
      path: '/legacy',
      pluginId: 'legacy-source',
      chapters: [
        {
          id: 50101,
          novelId: 999,
          path: '/legacy/1',
          name: 'Legacy chapter',
        },
      ],
      ignoredLegacyField: 'ignored',
    };
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path === '/cache/NovelAndChapters');
    jest.mocked(NativeFile.readDir).mockResolvedValue([
      {
        name: 'legacy.json',
        path: '/cache/NovelAndChapters/legacy.json',
        isDirectory: false,
      },
    ]);
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          sections: options,
        });
      }
      return JSON.stringify(legacyNovel);
    });

    const result = await restoreData('/cache');

    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(
      [
        {
          id: 501,
          name: 'Legacy novel',
          path: '/legacy',
          pluginId: 'legacy-source',
          cover: null,
          summary: null,
          author: null,
          artist: null,
          status: null,
          genres: null,
          inLibrary: null,
          isLocal: null,
          totalPages: null,
          chapters: [
            {
              id: 50101,
              novelId: 501,
              path: '/legacy/1',
              name: 'Legacy chapter',
              releaseTime: null,
              readTime: null,
              bookmark: null,
              unread: null,
              isDownloaded: null,
              updatedTime: null,
              chapterNumber: null,
              page: null,
              progress: null,
              position: null,
              scanlator: null,
              timeSpent: null,
            },
          ],
        },
      ],
      { includeChapterMappings: false },
    );
    expect(result).toMatchObject({
      restoreRunId: expect.any(String),
      novelCount: 1,
      failedNovelCount: 0,
    });
  });
  it('restores legacy novels whose stored name is empty', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    };
    const legacyNovel = {
      id: 701,
      name: '',
      path: '/legacy/empty-name',
      pluginId: 'legacy-source',
      chapters: [],
    };
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path === '/cache/NovelAndChapters');
    jest.mocked(NativeFile.readDir).mockResolvedValue([
      {
        name: 'empty-name.json',
        path: '/cache/NovelAndChapters/empty-name.json',
        isDirectory: false,
      },
    ]);
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          sections: options,
        });
      }
      return JSON.stringify(legacyNovel);
    });

    const result = await restoreData('/cache');

    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 701,
          name: '',
          path: '/legacy/empty-name',
          pluginId: 'legacy-source',
        }),
      ],
      { includeChapterMappings: false },
    );
    expect(result).toMatchObject({
      novelCount: 1,
      failedNovelCount: 0,
    });
  });

  it('rejects duplicate source IDs, novel identities, and chapter identities before restoring invalid files', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: true,
    };
    const validNovel = makeTestNovel(601, 'source');
    const duplicateIdNovel = makeTestNovel(601, 'other-source');
    const duplicateIdentityNovel = {
      ...makeTestNovel(602, 'source'),
      path: validNovel.path,
    };
    const duplicateChapterIdentityNovel = {
      ...makeTestNovel(603, 'source'),
      chapters: [
        makeTestChapter(603, 1),
        { ...makeTestChapter(603, 1), id: 60302 },
      ],
    };
    const payloads = {
      'batch-000001.json': JSON.stringify(encodeNovelBatch([validNovel])),
      'batch-000002.json': JSON.stringify(encodeNovelBatch([duplicateIdNovel])),
      'batch-000003.json': JSON.stringify(
        encodeNovelBatch([duplicateIdentityNovel]),
      ),
      'batch-000004.json': JSON.stringify(
        encodeNovelBatch([duplicateChapterIdentityNovel]),
      ),
    };
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path === '/cache/NovelAndChapters');
    jest.mocked(NativeFile.readDir).mockResolvedValue(
      Object.keys(payloads)
        .reverse()
        .map(name => ({
          name,
          path: `/cache/NovelAndChapters/${name}`,
          isDirectory: false,
        })),
    );
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          novelDataFormat: 2,
          sections: options,
        });
      }
      return payloads[path.split('/').pop() as keyof typeof payloads];
    });

    const result = await restoreData('/cache');

    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith([validNovel], {
      includeChapterMappings: true,
      restoreRunId: expect.any(String),
    });
    expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      restoreRunId: expect.any(String),
      novelCount: 1,
      failedNovelCount: 3,
      pluginIds: ['source'],
    });
  });

  it('skips malformed compact files without partially restoring them', async () => {
    const options: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: true,
    };
    const validNovel = makeTestNovel(901, 'valid-source');
    const [validRecord] = encodeNovelBatch([validNovel]);
    const malformedFiles: Record<string, string> = {
      'batch-000001.json': '{',
      'batch-000002.json': JSON.stringify({}),
      'batch-000003.json': JSON.stringify([{ ...validRecord, n: undefined }]),
      'batch-000004.json': JSON.stringify([
        validRecord,
        {
          ...validRecord,
          c: [[...validRecord.c[0]].slice(0, 14)],
        },
      ]),
      'batch-000005.json': JSON.stringify([{ ...validRecord, id: 'bad' }]),
      'batch-000006.json': JSON.stringify([{ ...validRecord, p: 123 }]),
      'batch-000007.json': JSON.stringify([validRecord]),
    };
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path === '/cache/NovelAndChapters');
    jest.mocked(NativeFile.readDir).mockResolvedValue(
      Object.keys(malformedFiles)
        .reverse()
        .map(name => ({
          name,
          path: `/cache/NovelAndChapters/${name}`,
          isDirectory: false,
        })),
    );
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) {
        return JSON.stringify({
          appVersion: '2.1.3',
          formatVersion: 2,
          novelDataFormat: 2,
          sections: options,
        });
      }
      return malformedFiles[path.split('/').pop() ?? ''];
    });

    const result = await restoreData('/cache');
    expect(
      jest
        .mocked(NativeFile.readFile)
        .mock.calls.map(([path]) => path)
        .filter(path => path.includes('/NovelAndChapters/')),
    ).toEqual([
      ...Object.keys(malformedFiles)
        .sort()
        .map(name => `/cache/NovelAndChapters/${name}`),
      '/cache/NovelAndChapters/batch-000007.json',
    ]);

    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 901,
          pluginId: 'valid-source',
          chapters: [
            expect.objectContaining({
              id: 90101,
              novelId: 901,
            }),
          ],
        }),
      ],
      {
        includeChapterMappings: true,
        restoreRunId: expect.any(String),
      },
    );
    expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      restoreRunId: expect.any(String),
      novelCount: 1,
      failedNovelCount: 7,
    });
  });

  it('treats backups without a section manifest as legacy full backups', async () => {
    jest
      .mocked(NativeFile.readFile)
      .mockResolvedValueOnce(JSON.stringify({ version: '2.0.0' }));

    const result = await restoreData('/cache');

    expect(result.manifest).toMatchObject({
      appVersion: '2.0.0',
      formatVersion: 1,
      sections: {
        library: true,
        settings: true,
        plugins: true,
        downloadedFiles: true,
      },
    });
    expect(result.restoreRunId).toEqual(expect.any(String));
  });
  it('does not reject when restore mapping cleanup fails', async () => {
    jest
      .mocked(clearRestoreChapterMappings)
      .mockRejectedValueOnce(new Error('mapping cleanup failed'));

    await expect(
      clearRestoreChapterMappingsSafely('restore-run'),
    ).resolves.toBeUndefined();
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith('restore-run');
  });
});
