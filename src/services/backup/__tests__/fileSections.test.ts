import NativeFile from '@modules/native-file';
import {
  getSelectedBackupFileSections,
  restoreLegacyFiles,
  restoreNovelFiles,
} from '../fileSections';
import { getRestoreChapterMappings } from '@database/queries/NovelRestoreQueries';
import { ZipBackupName } from '../types';

jest.mock('@database/queries/NovelRestoreQueries', () => ({
  getRestoreChapterMappings: jest.fn(),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  PLUGIN_STORAGE: '/storage/Plugins',
}));

describe('selected backup file sections', () => {
  const options = {
    library: true,
    settings: true,
    plugins: true,
    downloadedFiles: true,
  };

  it('keeps novel files in the legacy v2 section only', () => {
    expect(getSelectedBackupFileSections(options)).toEqual([
      {
        archiveName: ZipBackupName.PLUGINS,
        storagePath: '/storage/Plugins',
      },
    ]);
    expect(getSelectedBackupFileSections(options, 2)).toEqual([
      {
        archiveName: ZipBackupName.PLUGINS,
        storagePath: '/storage/Plugins',
      },
      {
        archiveName: ZipBackupName.NOVEL_FILES,
        storagePath: '/storage/Novels',
      },
    ]);
  });
});

describe('restore file sections', () => {
  beforeEach(() => {
    jest.mocked(getRestoreChapterMappings).mockReset();
  });

  it('moves downloaded files with bounded staged mapping lookups', async () => {
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.mkdir).mockResolvedValue(undefined);
    jest.mocked(NativeFile.moveFile).mockResolvedValue(undefined);
    jest.mocked(NativeFile.unlink).mockResolvedValue(undefined);
    const chapterItems = Array.from({ length: 101 }, (_, index) => ({
      name: String(index + 1),
      path: `/staging/source/1/${index + 1}`,
      isDirectory: true,
    }));
    jest.mocked(NativeFile.readDir).mockImplementation(async path => {
      if (path === '/staging/source/1') {
        return [
          {
            name: 'cover.png',
            path: '/staging/source/1/cover.png',
            isDirectory: false,
          },
          ...chapterItems,
        ];
      }
      if (path === '/staging/source/1/10') {
        return [
          {
            name: 'index.html',
            path: '/staging/source/1/10/index.html',
            isDirectory: false,
          },
        ];
      }
      if (path === '/staging/source/1/101') {
        return [
          {
            name: 'index.html',
            path: '/staging/source/1/101/index.html',
            isDirectory: false,
          },
        ];
      }
      return [];
    });
    jest
      .mocked(getRestoreChapterMappings)
      .mockImplementation(
        async (_restoreRunId, _backupNovelId, backupChapterIds) =>
          backupChapterIds
            .filter(id => id === 10 || id === 101)
            .map(backupChapterId => ({
              backupChapterId,
              restoredChapterId: backupChapterId === 10 ? 99 : 199,
            })),
      );

    await restoreNovelFiles(
      '/staging',
      [
        {
          pluginId: 'source',
          backupNovelId: 1,
          restoredNovelId: 7,
        },
      ],
      'restore-run-1',
    );

    expect(getRestoreChapterMappings).toHaveBeenCalledTimes(2);
    expect(getRestoreChapterMappings).toHaveBeenNthCalledWith(
      1,
      'restore-run-1',
      1,
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    expect(getRestoreChapterMappings).toHaveBeenNthCalledWith(
      2,
      'restore-run-1',
      1,
      [101],
    );
    expect(NativeFile.moveFile).toHaveBeenCalledWith(
      '/staging/source/1/cover.png',
      '/storage/Novels/source/7/cover.png',
    );
    expect(NativeFile.moveFile).toHaveBeenCalledWith(
      '/staging/source/1/10/index.html',
      '/storage/Novels/source/7/99/index.html',
    );
    expect(NativeFile.moveFile).toHaveBeenCalledWith(
      '/staging/source/1/101/index.html',
      '/storage/Novels/source/7/199/index.html',
    );
    expect(NativeFile.moveFile).not.toHaveBeenCalledWith(
      expect.stringContaining('/20/'),
      expect.any(String),
    );
    expect(NativeFile.unlink).toHaveBeenCalledWith('/staging');
  });

  it('passes the restore run ID through legacy file restoration', async () => {
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.mkdir).mockResolvedValue(undefined);
    jest.mocked(NativeFile.moveFile).mockResolvedValue(undefined);
    jest.mocked(NativeFile.unlink).mockResolvedValue(undefined);
    jest.mocked(NativeFile.readDir).mockImplementation(async path => {
      if (path === '/legacy/Novels/source/1') {
        return [
          {
            name: '10',
            path: '/legacy/Novels/source/1/10',
            isDirectory: true,
          },
        ];
      }
      return [];
    });
    jest
      .mocked(getRestoreChapterMappings)
      .mockResolvedValue([{ backupChapterId: 10, restoredChapterId: 99 }]);

    await restoreLegacyFiles(
      '/legacy',
      [
        {
          pluginId: 'source',
          backupNovelId: 1,
          restoredNovelId: 7,
        },
      ],
      'legacy-run',
    );

    expect(getRestoreChapterMappings).toHaveBeenCalledWith('legacy-run', 1, [
      10,
    ]);
    expect(NativeFile.unlink).toHaveBeenCalledWith('/legacy');
  });
});
