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
import NativeZipArchive from '@modules/native-zip-archive';
import {
  assertSupportedBackupArchive,
  clearRestoreWorkingFiles,
  clearRestoreWorkingFilesAfterRestore,
  isPickedBackupPath,
  prepareBackupData,
  restoreData,
} from '../utils';
import { createArchiveBackupSource } from '../backupSource';
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
    jest.mocked(NativeFile.moveFile).mockResolvedValue(undefined);
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

    expect(NativeFile.moveFile).toHaveBeenCalledWith(
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
      { withChapterMappings: false },
    );
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
      for (let id = 1; id <= 450; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);

      const result = await restoreData('/cache');

      const batches = jest
        .mocked(_restoreNovelsAndChapters)
        .mock.calls.map(([novels]) => novels.map(novel => novel.id));
      expect(batches.map(batch => batch.length)).toEqual([200, 200, 50]);
      expect(batches.flat()).toEqual(
        Array.from({ length: 450 }, (_, i) => i + 1),
      );
      expect(result.novelCount).toBe(450);
      expect(result.novelMappings.map(m => m.backupNovelId)).toEqual(
        batches.flat(),
      );
    });

    it('starts a new batch once the chapter budget is reached', async () => {
      mockBackup({
        '1.json': novelFile(1, 16000),
        '2.json': novelFile(2, 6000),
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
      for (let id = 1; id <= 450; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);

      const texts = await novelProgress();

      expect(texts[texts.length - 1]).toBe(
        'backupScreen.restoringNovelsProgress {"current":450,"total":450}',
      );
    });

    it('reports every batch boundary even when batches finish instantly', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 450; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);

      const texts = await novelProgress();

      expect(texts).toEqual(
        [0, 200, 400, 450].map(
          current =>
            `backupScreen.restoringNovelsProgress {"current":${current},"total":450}`,
        ),
      );
    });

    it('reports the full count once when it falls on a batch boundary', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 400; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);

      const texts = await novelProgress();

      expect(texts).toEqual(
        [0, 200, 400].map(
          current =>
            `backupScreen.restoringNovelsProgress {"current":${current},"total":400}`,
        ),
      );
    });

    it('keeps backup order when files finish reading out of order', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 450; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);
      const readFile = jest
        .mocked(NativeFile.readFile)
        .getMockImplementation()!;
      jest.mocked(NativeFile.readFile).mockImplementation(async path => {
        const id = Number(path.split('/').pop()!.replace('.json', ''));
        if (id % 3 === 1) {
          await new Promise(resolve => setTimeout(resolve, 3));
        }
        return readFile(path);
      });

      const result = await restoreData('/cache');

      const batches = jest
        .mocked(_restoreNovelsAndChapters)
        .mock.calls.map(([novels]) => novels.map(novel => novel.id));
      expect(batches.map(batch => batch.length)).toEqual([200, 200, 50]);
      expect(batches.flat()).toEqual(
        Array.from({ length: 450 }, (_, i) => i + 1),
      );
      expect(result.novelMappings.map(m => m.backupNovelId)).toEqual(
        batches.flat(),
      );
    });

    it('reads ahead of a slow write only within its bounds', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 1000; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);
      const readFile = jest
        .mocked(NativeFile.readFile)
        .getMockImplementation()!;
      let novelFilesRead = 0;
      jest.mocked(NativeFile.readFile).mockImplementation(async path => {
        if (path.includes('/NovelAndChapters/')) novelFilesRead++;
        return readFile(path);
      });
      const restore = jest
        .mocked(_restoreNovelsAndChapters)
        .getMockImplementation()!;
      const readWhenWritten: number[] = [];
      jest
        .mocked(_restoreNovelsAndChapters)
        .mockImplementation(async novels => {
          await new Promise(resolve => setTimeout(resolve, 20));
          readWhenWritten.push(novelFilesRead);
          return restore(novels);
        });

      const result = await restoreData('/cache');

      expect(result.novelCount).toBe(1000);
      // The first write holds novels 1-200; reading continued meanwhile, but
      // never further than one batch past the novels already consumed.
      expect(readWhenWritten[0]).toBeGreaterThan(200);
      expect(readWhenWritten[0]).toBeLessThanOrEqual(200 + 200 + 4);
    });

    it('stops reading novel files once the restore is aborted', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 1000; id++) files[`${id}.json`] = novelFile(id);
      mockBackup(files);
      const readFile = jest
        .mocked(NativeFile.readFile)
        .getMockImplementation()!;
      let novelFilesRead = 0;
      jest.mocked(NativeFile.readFile).mockImplementation(async path => {
        if (path.includes('/NovelAndChapters/')) novelFilesRead++;
        return readFile(path);
      });
      let updates = 0;

      // A progress updater that throws is how a cancelled task stops.
      const result = await restoreData('/cache', () => {
        if (++updates === 3) throw new Error('cancelled');
      });
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(result.failedSectionCount).toBe(1);
      expect(novelFilesRead).toBeLessThan(1000);
      expect(jest.mocked(_restoreNovelsAndChapters).mock.calls.length).toBe(1);
    });

    it('moves covers eight at a time while later batches are written', async () => {
      const files: Record<string, string> = {};
      for (let id = 1; id <= 450; id++) {
        files[`${id}.json`] = JSON.stringify({
          id,
          name: `Novel ${id}`,
          path: `/novel-${id}`,
          pluginId: 'source',
          cover: `/Novels/source/${id}/cover.png`,
          chapters: [],
        });
      }
      mockBackup(files);
      const exists = jest.mocked(NativeFile.exists).getMockImplementation()!;
      jest
        .mocked(NativeFile.exists)
        .mockImplementation(
          async path => path.startsWith('/cache/Covers/') || exists(path),
        );
      let copying = 0;
      let mostCopying = 0;
      let copied = 0;
      jest.mocked(NativeFile.moveFile).mockClear();
      jest.mocked(NativeFile.moveFile).mockImplementation(async () => {
        mostCopying = Math.max(mostCopying, ++copying);
        await new Promise(resolve => setTimeout(resolve, 2));
        copying--;
        copied++;
      });
      const restore = jest
        .mocked(_restoreNovelsAndChapters)
        .getMockImplementation()!;
      const copiedWhenWriteStarted: number[] = [];
      jest
        .mocked(_restoreNovelsAndChapters)
        .mockImplementation(async (...args) => {
          copiedWhenWriteStarted.push(copied);
          return restore(...args);
        });

      const result = await restoreData('/cache');

      expect(result).toMatchObject({ novelCount: 450, failedNovelCount: 0 });
      expect(copied).toBe(450);
      expect(mostCopying).toBe(8);
      // The second write did not wait for the first batch's 200 covers.
      expect(copiedWhenWriteStarted[1]).toBeLessThan(200);
    });

    describe('backup novels that restore into the same novel', () => {
      const duplicate = (id: number) =>
        JSON.stringify({
          id,
          name: `Novel ${id}`,
          path: '/same-novel',
          pluginId: 'source',
          cover: `/Novels/source/${id}/cover.png`,
          chapters: [],
        });
      const restoreDuplicates = async (coversInBackup: string[]) => {
        mockBackup({ '1.json': duplicate(1), '2.json': duplicate(2) });
        const exists = jest.mocked(NativeFile.exists).getMockImplementation()!;
        jest
          .mocked(NativeFile.exists)
          .mockImplementation(
            async path => coversInBackup.includes(path) || exists(path),
          );
        jest
          .mocked(_restoreNovelsAndChapters)
          .mockImplementationOnce(async novels =>
            novels.map(novel => ({
              mapping: {
                pluginId: novel.pluginId,
                backupNovelId: novel.id,
                restoredNovelId: 500,
                chapters: [],
              },
            })),
          );
        let copying = 0;
        let mostCopying = 0;
        jest.mocked(NativeFile.moveFile).mockClear();
        jest.mocked(NativeFile.moveFile).mockImplementation(async () => {
          mostCopying = Math.max(mostCopying, ++copying);
          await new Promise(resolve => setTimeout(resolve, 2));
          copying--;
        });
        const result = await restoreData('/cache');
        return { result, mostCopying };
      };
      const destination = '/storage/Novels/source/500/cover.png';

      it('moves the covers in backup order so the last one wins', async () => {
        const { result, mostCopying } = await restoreDuplicates([
          '/cache/Covers/1',
          '/cache/Covers/2',
        ]);

        expect(result).toMatchObject({ novelCount: 2, failedNovelCount: 0 });
        expect(jest.mocked(NativeFile.moveFile).mock.calls).toEqual([
          ['/cache/Covers/1', destination],
          ['/cache/Covers/2', destination],
        ]);
        expect(mostCopying).toBe(1);
      });

      it('keeps an earlier cover when the last one is missing from the backup', async () => {
        const { result } = await restoreDuplicates(['/cache/Covers/1']);

        expect(result).toMatchObject({ novelCount: 2, failedNovelCount: 0 });
        expect(jest.mocked(NativeFile.moveFile).mock.calls).toEqual([
          ['/cache/Covers/1', destination],
        ]);
      });
    });

    it('asks for chapter id mappings only when downloaded files will be restored', async () => {
      const mappingsRequested = async (sections: BackupOptions | undefined) => {
        mockBackup({ '1.json': novelFile(1) });
        const readFile = jest
          .mocked(NativeFile.readFile)
          .getMockImplementation()!;
        jest.mocked(NativeFile.readFile).mockImplementation(async path => {
          if (!path.endsWith('/Version.json')) return readFile(path);
          return JSON.stringify(
            sections
              ? { appVersion: '2.1.4', formatVersion: 2, sections }
              : { version: '2.0.0' },
          );
        });
        jest.mocked(_restoreNovelsAndChapters).mockClear();
        await restoreData('/cache');
        return jest.mocked(_restoreNovelsAndChapters).mock.calls[0][1];
      };

      expect(await mappingsRequested(libraryOnly)).toEqual({
        withChapterMappings: false,
      });
      expect(
        await mappingsRequested({ ...libraryOnly, downloadedFiles: true }),
      ).toEqual({ withChapterMappings: true });
      // Legacy backups always carry downloaded files.
      expect(await mappingsRequested(undefined)).toEqual({
        withChapterMappings: true,
      });
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

describe('unsupported backup formats', () => {
  const allSections: BackupOptions = {
    library: true,
    settings: true,
    plugins: true,
    downloadedFiles: false,
  };
  // The layout of a format 3 backup: novels are JSON arrays in batch files.
  const formatThreeManifest = JSON.stringify({
    appVersion: '2.1.3',
    formatVersion: 3,
    novelDataFormat: 2,
    sections: allSections,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(MMKVStorage.getString).mockReturnValue(undefined);
  });

  const mockFormatThreeBackup = (batchCount: number) => {
    const batchFile = JSON.stringify([
      { c: [], id: 1, p: '/novel-1', pi: 'source', n: 'Novel 1' },
    ]);
    jest.mocked(NativeFile.readFile).mockImplementation(async path => {
      if (path.endsWith('/Version.json')) return formatThreeManifest;
      if (path.endsWith('/Setting.json')) {
        return JSON.stringify({ THEME: 'changed' });
      }
      if (path.endsWith('/Category.json')) {
        return JSON.stringify([
          { id: 7, name: 'Added', sort: 1, novelIds: [] },
        ]);
      }
      return batchFile;
    });
    jest.mocked(NativeFile.readDir).mockResolvedValue(
      Array.from({ length: batchCount }, (_, i) => ({
        name: `batch-${i}.json`,
        path: `/cache/NovelAndChapters/batch-${i}.json`,
        isDirectory: false,
      })),
    );
  };

  it('rejects a format 3 backup without touching the database, categories or settings', async () => {
    mockFormatThreeBackup(74);

    await expect(restoreData('/cache')).rejects.toThrow(
      'backupScreen.unsupportedBackupFormat',
    );

    expect(NativeFile.readDir).not.toHaveBeenCalled();
    expect(_restoreNovelsAndChapters).not.toHaveBeenCalled();
    expect(_restoreCategory).not.toHaveBeenCalled();
    expect(MMKVStorage.set).not.toHaveBeenCalled();
  });

  it('rejects an extracted manifest too large to read without reading it', async () => {
    mockFormatThreeBackup(1);
    jest.mocked(NativeFile.fileSize).mockResolvedValueOnce(300 * 1024 * 1024);

    await expect(restoreData('/cache')).rejects.toThrow(
      'backupScreen.unsupportedBackupFormat',
    );

    expect(NativeFile.fileSize).toHaveBeenCalledWith('/cache/Version.json');
    expect(NativeFile.readFile).not.toHaveBeenCalled();
    expect(_restoreNovelsAndChapters).not.toHaveBeenCalled();
    expect(_restoreCategory).not.toHaveBeenCalled();
    expect(MMKVStorage.set).not.toHaveBeenCalled();
  });

  it('rejects an unsupported archive from its manifest alone', async () => {
    jest
      .mocked(NativeZipArchive.readEntry)
      .mockResolvedValueOnce(formatThreeManifest);

    await expect(
      assertSupportedBackupArchive('content://backup.zip'),
    ).rejects.toThrow('backupScreen.unsupportedBackupFormat');

    expect(NativeZipArchive.readEntry).toHaveBeenCalledWith(
      'content://backup.zip',
      'Version.json',
    );
  });

  it.each([
    ['no manifest', null],
    ['a legacy manifest', JSON.stringify({ version: '2.0.0' })],
    ['format 1', JSON.stringify({ formatVersion: 1 })],
    [
      'the current format',
      JSON.stringify({ formatVersion: 2, sections: allSections }),
    ],
    ['an unreadable manifest', '{"formatVers'],
  ])('accepts an archive with %s', async (_name, manifest) => {
    jest.mocked(NativeZipArchive.readEntry).mockResolvedValueOnce(manifest);

    await expect(
      assertSupportedBackupArchive('content://backup.zip'),
    ).resolves.toBeUndefined();
  });

  it('rejects an archive whose manifest is too large to read', async () => {
    jest
      .mocked(NativeZipArchive.readEntry)
      .mockRejectedValueOnce(
        Object.assign(new Error('too large'), { code: 'ENTRY_TOO_LARGE' }),
      );

    await expect(
      assertSupportedBackupArchive('content://backup.zip'),
    ).rejects.toThrow('backupScreen.unsupportedBackupFormat');
  });

  it('leaves the check to the extracted backup when the archive cannot be read first', async () => {
    jest
      .mocked(NativeZipArchive.readEntry)
      .mockRejectedValueOnce(new Error('not seekable'));

    await expect(
      assertSupportedBackupArchive('content://backup.zip'),
    ).resolves.toBeUndefined();
  });

  describe('read-ahead on oddly shaped novel files', () => {
    const currentManifest = JSON.stringify({
      appVersion: '2.1.4',
      formatVersion: 2,
      sections: { ...allSections, settings: false, plugins: false },
    });

    const mockFiles = (files: Record<string, string>) => {
      const reads: string[] = [];
      jest.mocked(NativeFile.readFile).mockImplementation(async path => {
        if (path.endsWith('/Version.json')) return currentManifest;
        if (path.endsWith('/Category.json')) return '[]';
        const name = path.split('/').pop()!;
        reads.push(name);
        return files[name];
      });
      jest.mocked(NativeFile.readDir).mockResolvedValue(
        Object.keys(files).map(name => ({
          name,
          path: `/cache/NovelAndChapters/${name}`,
          isDirectory: false,
        })),
      );
      return reads;
    };

    it('holds only a bounded number of files before the first write when novels have no chapters', async () => {
      const padding = 'x'.repeat(4 * 1024 * 1024);
      const files: Record<string, string> = {};
      for (let id = 1; id <= 40; id++) {
        files[`${id}.json`] = JSON.stringify({
          id,
          path: `/novel-${id}`,
          pluginId: 'source',
          chapters: [],
          summary: padding,
        });
      }
      const reads = mockFiles(files);
      let readsBeforeFirstWrite = -1;
      jest
        .mocked(_restoreNovelsAndChapters)
        .mockImplementation(async novels => {
          if (readsBeforeFirstWrite < 0) readsBeforeFirstWrite = reads.length;
          return novels.map(novel => ({
            mapping: {
              pluginId: novel.pluginId,
              backupNovelId: novel.id,
              restoredNovelId: novel.id,
              chapters: [],
            },
          }));
        });

      const result = await restoreData('/cache');

      expect(result.novelCount).toBe(40);
      expect(readsBeforeFirstWrite).toBeGreaterThan(0);
      expect(readsBeforeFirstWrite).toBeLessThan(20);
    });

    it('fails files that are not novels one by one without holding them', async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 74; i++) {
        files[`batch-${i}.json`] = JSON.stringify([
          { c: [], id: i, p: `/novel-${i}`, pi: 'source' },
        ]);
      }
      files['no-chapters.json'] = JSON.stringify({
        id: 900,
        path: '/n',
        pluginId: 'source',
      });
      files['no-plugin.json'] = JSON.stringify({
        id: 901,
        path: '/n',
        chapters: [],
      });
      files['null.json'] = 'null';
      files['valid.json'] = JSON.stringify({
        id: 1,
        path: '/novel-1',
        pluginId: 'source',
        chapters: [],
      });
      mockFiles(files);
      jest.mocked(_restoreNovelsAndChapters).mockImplementation(async novels =>
        novels.map(novel => ({
          mapping: {
            pluginId: novel.pluginId,
            backupNovelId: novel.id,
            restoredNovelId: novel.id,
            chapters: [],
          },
        })),
      );

      const result = await restoreData('/cache');

      expect(result.novelCount).toBe(1);
      expect(result.failedNovelCount).toBe(77);
      expect(result.pluginIds).toEqual(['source']);
      expect(
        jest
          .mocked(_restoreNovelsAndChapters)
          .mock.calls.map(([novels]) => novels.map(novel => novel.id)),
      ).toEqual([[1]]);
    });
  });
});

describe('restoring from an archive read in place', () => {
  it('reads novels from the archive and writes covers straight to novel storage', async () => {
    const sections: BackupOptions = {
      library: true,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    };
    const entries: Record<string, string> = {
      'Version.json': JSON.stringify({
        appVersion: '2.1.4',
        formatVersion: 2,
        sections,
      }),
      'NovelAndChapters/1.json': JSON.stringify({
        id: 1,
        name: 'Novel 1',
        path: '/novel-1',
        pluginId: 'source',
        cover: '/Novels/source/1/cover.png',
        chapters: [{ id: 10, path: '/novel-1/chapter-1' }],
      }),
      'Category.json': '[]',
      'Covers/1': 'png',
    };
    jest
      .mocked(NativeZipArchive.archiveEntryExists)
      .mockImplementation(
        async (_, path) => path in entries || path === 'NovelAndChapters',
      );
    jest
      .mocked(NativeZipArchive.archiveEntrySize)
      .mockImplementation(async (_, path) => entries[path].length);
    jest
      .mocked(NativeZipArchive.readArchiveFile)
      .mockImplementation(async (_, path) => entries[path]);
    jest
      .mocked(NativeZipArchive.readArchiveDir)
      .mockResolvedValue([
        { name: '1.json', path: 'NovelAndChapters/1.json', isDirectory: false },
      ]);
    jest.mocked(NativeZipArchive.extractArchiveFile).mockClear();
    jest.mocked(NativeFile.readFile).mockClear();
    jest.mocked(NativeFile.copyFile).mockClear();
    jest.mocked(NativeFile.moveFile).mockClear();
    jest.mocked(_restoreNovelsAndChapters).mockClear();

    const result = await restoreData(createArchiveBackupSource(3));

    expect(result).toMatchObject({
      novelCount: 1,
      failedNovelCount: 0,
      failedSectionCount: 0,
    });
    expect(_restoreNovelsAndChapters).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1, name: 'Novel 1' })],
      { withChapterMappings: false },
    );
    expect(NativeZipArchive.extractArchiveFile).toHaveBeenCalledWith(
      3,
      'Covers/1',
      '/storage/Novels/source/1/cover.png',
    );
    expect(NativeFile.readFile).not.toHaveBeenCalled();
    expect(NativeFile.copyFile).not.toHaveBeenCalled();
    expect(NativeFile.moveFile).not.toHaveBeenCalled();
  });
});

describe('reading a backup in place against reading it unpacked', () => {
  const sections: BackupOptions = {
    library: true,
    settings: true,
    plugins: true,
    downloadedFiles: false,
  };
  const novel = (id: number, cover: string | null, path = `/novel-${id}`) =>
    JSON.stringify({
      id,
      name: `Novel ${id}`,
      path,
      pluginId: id % 2 ? 'odd' : 'even',
      cover,
      chapters: Array.from({ length: id % 4 }, (_, i) => ({
        id: id * 100 + i,
        path: `${path}/chapter-${i}`,
      })),
    });
  // The same backup contents, by path relative to the backup root.
  const backup: Record<string, string> = {
    'Version.json': JSON.stringify({
      appVersion: '2.1.4',
      formatVersion: 2,
      sections,
    }),
    'Category.json': JSON.stringify([
      { id: 2, name: 'Reading', sort: 1, novelIds: [1, 2, 3, 99] },
      { id: 3, name: 'Done', sort: 2, novelIds: [] },
    ]),
    'Setting.json': JSON.stringify({ theme: 'dark', fontSize: '18' }),
    'Plugins.json': JSON.stringify([{ id: 'odd', version: '1.0.0' }]),
    'Covers/1': 'png-1',
    'Covers/3': 'png-3',
    'Covers/5': 'png-5',
    'NovelAndChapters/broken.json': '{"not": "a novel"}',
  };
  for (let id = 1; id <= 260; id++) {
    backup[`NovelAndChapters/${id}.json`] = novel(
      id,
      id % 2 ? `/Novels/source/${id}/cover.png` : `https://covers/${id}.png`,
      // Two backup novels that restore into one novel share a cover file.
      id === 5 ? '/novel-3' : `/novel-${id}`,
    );
  }
  const novelNames = Object.keys(backup)
    .filter(path => path.startsWith('NovelAndChapters/'))
    .map(path => path.slice('NovelAndChapters/'.length));

  const restoreAndRecord = async (readInPlace: boolean) => {
    const restoredIdByPath = new Map<string, number>();
    jest.mocked(_restoreNovelsAndChapters).mockReset();
    jest.mocked(_restoreNovelsAndChapters).mockImplementation(async novels =>
      novels.map(({ id, path, pluginId }) => {
        const restoredNovelId = restoredIdByPath.get(path) ?? id;
        restoredIdByPath.set(path, restoredNovelId);
        return {
          mapping: {
            pluginId,
            backupNovelId: id,
            restoredNovelId,
            chapters: [],
          },
        };
      }),
    );
    jest.mocked(NativeFile.mkdir).mockResolvedValue(undefined);
    jest.mocked(_restoreCategory).mockClear();
    jest.mocked(_restoreCategory).mockResolvedValue(1);
    jest.mocked(MMKVStorage.set).mockClear();
    jest.mocked(MMKVStorage.getString).mockReturnValue('[]');
    jest.mocked(NativeFile.moveFile).mockReset();
    jest.mocked(NativeZipArchive.extractArchiveFile).mockReset();
    const coverWrites: [string, string][] = [];
    if (readInPlace) {
      jest
        .mocked(NativeZipArchive.archiveEntryExists)
        .mockImplementation(
          async (_, path) => path in backup || path === 'NovelAndChapters',
        );
      jest
        .mocked(NativeZipArchive.archiveEntrySize)
        .mockImplementation(async (_, path) => backup[path].length);
      jest
        .mocked(NativeZipArchive.readArchiveFile)
        .mockImplementation(async (_, path) => backup[path]);
      jest.mocked(NativeZipArchive.readArchiveDir).mockResolvedValue(
        novelNames.map(name => ({
          name,
          path: `NovelAndChapters/${name}`,
          isDirectory: false,
        })),
      );
      jest
        .mocked(NativeZipArchive.extractArchiveFile)
        .mockImplementation(async (_, path, destination) => {
          coverWrites.push([backup[path], destination]);
        });
    } else {
      const relative = (path: string) => path.slice('/cache/'.length);
      jest
        .mocked(NativeFile.exists)
        .mockImplementation(
          async path =>
            relative(path) in backup || relative(path) === 'NovelAndChapters',
        );
      jest
        .mocked(NativeFile.fileSize)
        .mockImplementation(async path => backup[relative(path)].length);
      jest
        .mocked(NativeFile.readFile)
        .mockImplementation(async path => backup[relative(path)]);
      jest.mocked(NativeFile.readDir).mockResolvedValue(
        novelNames.map(name => ({
          name,
          path: `/cache/NovelAndChapters/${name}`,
          isDirectory: false,
        })),
      );
      jest
        .mocked(NativeFile.moveFile)
        .mockImplementation(async (path, destination) => {
          coverWrites.push([backup[relative(path)], destination]);
        });
    }

    const result = await restoreData(
      readInPlace ? createArchiveBackupSource(1) : '/cache',
    );
    return {
      result,
      novelWrites: jest.mocked(_restoreNovelsAndChapters).mock.calls,
      categoryWrites: jest.mocked(_restoreCategory).mock.calls,
      settingsWrites: jest.mocked(MMKVStorage.set).mock.calls,
      coverWrites,
    };
  };

  it('restores exactly what the unpacked backup restores', async () => {
    const unpacked = await restoreAndRecord(false);
    const inPlace = await restoreAndRecord(true);

    expect(unpacked.result.novelCount).toBe(260);
    expect(unpacked.result.failedNovelCount).toBe(1);
    expect(unpacked.coverWrites).toContainEqual([
      'png-5',
      '/storage/Novels/odd/3/cover.png',
    ]);
    expect(inPlace).toEqual(unpacked);
  });
});

describe('restore working files', () => {
  const workingDir = '/mock/caches/BackupData';
  const sourceCopy = '/mock/caches/BackupData-source.zip';

  beforeEach(() => {
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.unlink).mockReset();
    jest.mocked(NativeFile.unlink).mockResolvedValue(undefined);
  });

  it('deletes only the unpacked backup and the local copy of the archive', async () => {
    await clearRestoreWorkingFiles('content://downloads/backup.zip');

    expect(jest.mocked(NativeFile.unlink).mock.calls).toEqual([
      [workingDir],
      [sourceCopy],
    ]);
  });

  it('never deletes the picked backup, even when it is a working file', async () => {
    await clearRestoreWorkingFiles(`file://${sourceCopy}`);
    await clearRestoreWorkingFiles(`${workingDir}/Backup.zip`);

    expect(jest.mocked(NativeFile.unlink).mock.calls).toEqual([
      [workingDir],
      [sourceCopy],
    ]);
  });

  it('recognises a picked working file behind a storage provider URI', () => {
    const cache = '/storage/emulated/0/Android/data/app/cache';
    const picked =
      'content://com.android.externalstorage.documents/document/' +
      encodeURIComponent(
        'primary:Android/data/app/cache/BackupData-source.zip',
      );

    expect(isPickedBackupPath(picked, `${cache}/BackupData-source.zip`)).toBe(
      true,
    );
    expect(isPickedBackupPath(picked, `${cache}/BackupData`)).toBe(false);
    expect(
      isPickedBackupPath(
        'content://com.android.providers.downloads.documents/document/' +
          encodeURIComponent('raw:/storage/emulated/0/Download/backup.zip'),
        `${cache}/BackupData-source.zip`,
      ),
    ).toBe(false);
  });

  it('keeps a restore result when cleaning up afterwards fails', async () => {
    jest.mocked(NativeFile.unlink).mockRejectedValue(new Error('busy'));

    await expect(
      clearRestoreWorkingFilesAfterRestore('content://backup.zip'),
    ).resolves.toBeUndefined();
  });
});
