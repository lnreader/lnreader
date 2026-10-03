import { getAllNovels } from '@database/queries/NovelQueries';
import { getAllNovelChaptersForBackup } from '@database/queries/ChapterQueries';
import {
  getAllNovelCategories,
  getCategoriesFromDb,
} from '@database/queries/CategoryQueries';
import NativeFile from '@modules/native-file';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { prepareBackupData } from '../create';
import { decodeNovelBatch, encodeNovelBatch } from '../novelPayload';
import type { BackupNovel, ChapterInfo } from '@database/types';
import type { BackupOptions } from '../options';

jest.mock('@database/queries/NovelQueries', () => ({
  getAllNovels: jest.fn(),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getAllNovelChaptersForBackup: jest.fn(),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
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

describe('selective backup creation', () => {
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
  it('stores the total novel count in the v3 manifest', async () => {
    const novels = [makeTestNovel(1), makeTestNovel(2), makeTestNovel(3)];
    jest.mocked(getAllNovels).mockResolvedValueOnce(novels);

    await prepareBackupData(
      '/cache',
      {
        library: true,
        settings: false,
        plugins: false,
        downloadedFiles: false,
      },
      3,
    );

    const manifestWrites = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.filter(([path]) => path.endsWith('/Version.json'));
    expect(
      JSON.parse(manifestWrites[manifestWrites.length - 1][1] ?? '{}'),
    ).toMatchObject({
      formatVersion: 3,
      novelCount: 3,
    });
  });

  it('counts only validated novels in the v3 manifest', async () => {
    const novels = [
      makeTestNovel(1),
      { ...makeTestNovel(2), name: 2 as unknown as string },
    ];
    jest.mocked(getAllNovels).mockResolvedValueOnce(novels);

    const result = await prepareBackupData(
      '/cache',
      {
        library: true,
        settings: false,
        plugins: false,
        downloadedFiles: false,
      },
      3,
    );

    const manifestWrites = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.filter(([path]) => path.endsWith('/Version.json'));
    expect(
      JSON.parse(manifestWrites[manifestWrites.length - 1][1]).novelCount,
    ).toBe(1);
    expect(result.failedNovelCount).toBe(1);
  });

  it('does not count novels from a failed batch write', async () => {
    jest
      .mocked(getAllNovels)
      .mockResolvedValueOnce([makeTestNovel(1), makeTestNovel(2)]);
    jest.mocked(NativeFile.writeFile).mockImplementation(async path => {
      if (path.includes('/NovelAndChapters/batch-')) {
        throw new Error('Novel batch write failed');
      }
    });

    const result = await prepareBackupData(
      '/cache',
      {
        library: true,
        settings: false,
        plugins: false,
        downloadedFiles: false,
      },
      3,
    );

    const manifestWrites = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.filter(([path]) => path.endsWith('/Version.json'));
    expect(
      JSON.parse(manifestWrites[manifestWrites.length - 1][1] ?? '{}')
        .novelCount,
    ).toBe(0);
    expect(result.failedNovelCount).toBe(2);
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

    const manifestWrites = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.filter(([path]) => path.endsWith('/Version.json'));
    expect(
      JSON.parse(manifestWrites[manifestWrites.length - 1][1] ?? '{}'),
    ).toMatchObject({
      formatVersion: 2,
      novelDataFormat: 2,
      novelCount: 101,
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
});
