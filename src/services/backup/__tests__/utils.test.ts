import {
  _restoreNovelsAndChapters,
  getAllNovels,
} from '@database/queries/NovelQueries';
import { getAllNovelChaptersForBackup } from '@database/queries/ChapterQueries';
import {
  _restoreCategory,
  getAllNovelCategories,
  getCategoriesFromDb,
} from '@database/queries/CategoryQueries';
import NativeFile from '@modules/native-file';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { prepareBackupData, restoreData } from '../utils';
import type { BackupOptions } from '../options';

jest.mock('@database/queries/NovelQueries', () => ({
  _restoreNovelsAndChapters: jest.fn(),
  getAllNovels: jest.fn(),
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
  getString: (key: string, params?: object) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
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

describe('selective backup data', () => {
  beforeEach(() => {
    jest.mocked(NativeFile.exists).mockResolvedValue(false);
    jest.mocked(NativeFile.mkdir).mockResolvedValue(undefined);
    jest.mocked(NativeFile.writeFile).mockResolvedValue(undefined);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(getAllNovels).mockResolvedValue([]);
    jest.mocked(getAllNovelChaptersForBackup).mockResolvedValue([]);
    jest.mocked(getCategoriesFromDb).mockResolvedValue([]);
    jest.mocked(getAllNovelCategories).mockResolvedValue([]);
    jest.mocked(_restoreNovelsAndChapters).mockImplementation(async novels =>
      novels.map(novel => ({
        mapping: {
          pluginId: novel.pluginId,
          backupNovelId: novel.id,
          restoredNovelId: novel.id,
          chapters: novel.chapters.map(chapter => ({
            backupChapterId: chapter.id,
            restoredChapterId: chapter.id,
          })),
        },
      })),
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
      failedNovelCount: 0,
      failedCategoryCount: 0,
      failedSectionCount: 0,
      settingsRestored: true,
      manifest: {
        formatVersion: 2,
        sections: pluginOnlyOptions,
      },
    });
    expect(_restoreNovelsAndChapters).not.toHaveBeenCalled();
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
        id: 1,
        name: 'Example',
        path: '/example',
        pluginId: 'source',
        cover: 'file:///storage/Novels/source/1/cover.png?123',
      },
    ]);
    jest.mocked(getAllNovelChaptersForBackup).mockResolvedValueOnce([
      {
        id: 10,
        novelId: 1,
        path: '/chapter-1',
        name: 'Chapter 1',
        isDownloaded: true,
      },
    ] as Awaited<ReturnType<typeof getAllNovelChaptersForBackup>>);

    await prepareBackupData('/cache', {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    });

    const novelWrite = jest
      .mocked(NativeFile.writeFile)
      .mock.calls.find(([path]) => path.endsWith('/1.json'));
    expect(JSON.parse(novelWrite?.[1] ?? '{}')).toMatchObject({
      cover: '/Novels/source/1/cover.png?123',
      chapters: [{ id: 10, isDownloaded: false }],
    });
    expect(NativeFile.copyFile).toHaveBeenCalledWith(
      'file:///storage/Novels/source/1/cover.png',
      '/cache/Covers/1',
    );
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
    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 1,
        cover: 'file:///storage/Novels/source/1/cover.png?123',
      }),
      expect.objectContaining({ id: 2, cover: null }),
    ]);
  });

  describe('library restore batching', () => {
    const libraryOnly: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    };

    beforeEach(() => {
      jest.mocked(_restoreNovelsAndChapters).mockClear();
    });

    const novelFile = (id: number, chapterCount = 1) =>
      JSON.stringify({
        id,
        name: `Novel ${id}`,
        path: `/novel-${id}`,
        pluginId: 'source',
        cover: null,
        chapters: Array.from({ length: chapterCount }, (_, i) => ({
          id: id * 10000 + i,
          path: `/novel-${id}/chapter-${i}`,
        })),
      });

    const mockBackup = (
      files: Record<string, string>,
      categories: object[] = [],
    ) => {
      jest.mocked(NativeFile.readFile).mockImplementation(async path => {
        if (path.endsWith('/Version.json')) {
          return JSON.stringify({
            appVersion: '2.1.4',
            formatVersion: 2,
            sections: libraryOnly,
          });
        }
        if (path.endsWith('/Category.json')) {
          return JSON.stringify(categories);
        }
        const name = path.split('/').pop()!;
        if (name in files) return files[name];
        throw new Error(`missing ${path}`);
      });
      jest
        .mocked(NativeFile.exists)
        .mockImplementation(async path =>
          ['/cache/NovelAndChapters', '/cache/Category.json'].includes(path),
        );
      jest.mocked(NativeFile.readDir).mockResolvedValue(
        Object.keys(files).map(name => ({
          name,
          path: `/cache/NovelAndChapters/${name}`,
          isDirectory: false,
        })),
      );
    };

    it('writes novels in bounded batches and keeps backup order', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 120; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);

      const result = await restoreData('/cache');

      const batches = jest
        .mocked(_restoreNovelsAndChapters)
        .mock.calls.map(([novels]) => novels.map(novel => novel.id));
      expect(batches.map(batch => batch.length)).toEqual([50, 50, 20]);
      expect(batches.flat()).toEqual(
        Array.from({ length: 120 }, (_, i) => i + 1),
      );
      expect(result.novelCount).toBe(120);
      expect(result.novelMappings.map(m => m.backupNovelId)).toEqual(
        batches.flat(),
      );
    });

    it('starts a new batch once the chapter budget is reached', async () => {
      mockBackup({
        '1.json': novelFile(1, 4000),
        '2.json': novelFile(2, 1500),
        '3.json': novelFile(3, 10),
      });

      await restoreData('/cache');

      expect(
        jest
          .mocked(_restoreNovelsAndChapters)
          .mock.calls.map(([novels]) => novels.map(novel => novel.id)),
      ).toEqual([[1, 2], [3]]);
    });

    it('counts unreadable and failed novels and skips their categories', async () => {
      mockBackup(
        {
          '1.json': novelFile(1),
          '2.json': '{"id": 2, "chapt',
          '3.json': novelFile(3),
          '4.json': novelFile(4),
        },
        [{ id: 7, name: 'Favourites', sort: 1, novelIds: [1, 2, 3, 4] }],
      );
      jest
        .mocked(_restoreNovelsAndChapters)
        .mockImplementationOnce(async novels =>
          novels.map(novel =>
            novel.id === 3
              ? { error: new Error('constraint failed') }
              : {
                  mapping: {
                    pluginId: novel.pluginId,
                    backupNovelId: novel.id,
                    restoredNovelId: novel.id + 100,
                    chapters: [],
                  },
                },
          ),
        );

      const result = await restoreData('/cache');

      expect(result).toMatchObject({
        novelCount: 2,
        failedNovelCount: 2,
        categoryCount: 1,
        failedSectionCount: 0,
      });
      expect(result.novelMappings.map(m => m.backupNovelId)).toEqual([1, 4]);
      expect(_restoreCategory).toHaveBeenCalledWith(
        expect.objectContaining({ id: 7, novelIds: [1, 4] }),
        new Map([
          [1, 101],
          [4, 104],
        ]),
      );
    });

    const novelProgress = async () => {
      const texts: string[] = [];
      await restoreData('/cache', transformer => {
        texts.push(transformer({} as never).progressText ?? '');
      });
      return texts.filter(text =>
        text.startsWith('backupScreen.restoringNovelsProgress'),
      );
    };

    it('reports the completed count after the last batch is written', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 120; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);

      const texts = await novelProgress();

      expect(texts[texts.length - 1]).toBe(
        'backupScreen.restoringNovelsProgress {"current":120,"total":120}',
      );
    });

    it('reports every batch boundary even when batches finish instantly', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 120; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);

      const texts = await novelProgress();

      expect(texts).toEqual(
        [0, 50, 100, 120].map(
          current =>
            `backupScreen.restoringNovelsProgress {"current":${current},"total":120}`,
        ),
      );
    });

    it('counts every novel in a batch whose transaction fails', async () => {
      mockBackup({ '1.json': novelFile(1), '2.json': novelFile(2) });
      jest
        .mocked(_restoreNovelsAndChapters)
        .mockRejectedValueOnce(new Error('disk I/O error'));

      const result = await restoreData('/cache');

      expect(result).toMatchObject({ novelCount: 0, failedNovelCount: 2 });
      expect(result.novelMappings).toEqual([]);
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
  });
});
