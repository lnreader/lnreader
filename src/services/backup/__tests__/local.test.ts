import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { clearRestoreChapterMappings } from '@database/queries/NovelRestoreQueries';
import { createBackup, restoreBackup } from '../local';
import * as fileSections from '../fileSections';
import { finalizeRestoredPlugins } from '../restoreResult';
import { prepareBackupData, restoreData } from '../utils';

jest.mock('@database/queries/NovelRestoreQueries', () => ({
  clearRestoreChapterMappings: jest.fn(),
  getRestoreChapterMappings: jest.fn(),
}));

jest.mock('../fileSections', () => {
  const actual = jest.requireActual('../fileSections');
  return {
    ...actual,
    restoreLegacyFiles: jest.fn(),
    restoreNovelFiles: jest.fn(),
  };
});

jest.mock('../utils', () => ({
  CACHE_DIR_PATH: '/cache/BackupData',
  clearBackupCache: jest.fn(),
  clearRestoreChapterMappingsSafely: jest.fn(async (restoreRunId: string) => {
    try {
      await jest
        .requireMock('@database/queries/NovelRestoreQueries')
        .clearRestoreChapterMappings(restoreRunId);
    } catch {
      // Match the production helper's best-effort cleanup.
    }
  }),
  prepareBackupData: jest.fn(),
  restoreData: jest.fn(),
}));

jest.mock('../restoreResult', () => ({
  finalizeRestoredPlugins: jest.fn(),
  getRestoreCompletionText: jest.fn(),
}));

jest.mock('../backupResult', () => ({
  getBackupCompletionText: jest.fn(() => 'Backup created'),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  PLUGIN_STORAGE: '/storage/Plugins',
  ROOT_STORAGE: '/storage',
}));

jest.mock('@utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

describe('local selective backup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  beforeEach(() => {
    jest.mocked(prepareBackupData).mockReset();
    jest.mocked(restoreData).mockReset();
    jest.mocked(NativeZipArchive.zip).mockReset().mockResolvedValue(undefined);
    jest
      .mocked(NativeZipArchive.zipDirectories)
      .mockReset()
      .mockResolvedValue(undefined);
    jest
      .mocked(NativeZipArchive.unzip)
      .mockReset()
      .mockResolvedValue(undefined);
    jest.mocked(NativeFile.copyFile).mockReset().mockResolvedValue(undefined);
    jest.mocked(NativeFile.exists).mockReset().mockResolvedValue(false);
    jest.mocked(NativeFile.mkdir).mockReset().mockResolvedValue(undefined);
    jest.mocked(NativeFile.unlink).mockReset().mockResolvedValue(undefined);
    jest.mocked(NativeFile.readDir).mockReset().mockResolvedValue([]);
    jest.mocked(finalizeRestoredPlugins).mockReset().mockResolvedValue([]);
    jest
      .mocked(clearRestoreChapterMappings)
      .mockReset()
      .mockResolvedValue(undefined);
    jest
      .mocked(fileSections.restoreLegacyFiles)
      .mockReset()
      .mockResolvedValue(undefined);
    jest
      .mocked(fileSections.restoreNovelFiles)
      .mockReset()
      .mockResolvedValue(undefined);
  });

  it('creates archives only for selected file sections', async () => {
    jest.mocked(prepareBackupData).mockResolvedValue({
      failedNovelCount: 0,
      failedSectionCount: 0,
    });
    jest.mocked(NativeZipArchive.zipDirectories).mockResolvedValue(undefined);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);

    await createBackup({
      destinationUri: 'content://backup.zip',
      options: {
        library: true,
        settings: true,
        plugins: true,
        downloadedFiles: false,
      },
    });

    expect(prepareBackupData).toHaveBeenCalledWith(
      '/cache/BackupData',
      {
        library: true,
        settings: true,
        plugins: true,
        downloadedFiles: false,
      },
      3,
    );
    expect(NativeZipArchive.zip).toHaveBeenCalledWith(
      '/storage/Plugins',
      '/cache/BackupData/plugins.zip',
    );
    expect(NativeZipArchive.zip).not.toHaveBeenCalledWith(
      '/storage/Novels',
      expect.any(String),
    );
    expect(NativeZipArchive.zipDirectories).toHaveBeenCalledWith(
      [{ path: '/cache/BackupData', prefix: '' }],
      '/cache/BackupData.zip',
    );
  });

  it('adds novel files to the v3 outer archive without a nested archive', async () => {
    jest.mocked(prepareBackupData).mockResolvedValue({
      failedNovelCount: 0,
      failedSectionCount: 0,
    });
    jest.mocked(NativeZipArchive.zip).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.zipDirectories).mockResolvedValue(undefined);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);

    await createBackup({
      destinationUri: 'content://backup.zip',
      options: {
        library: true,
        settings: true,
        plugins: true,
        downloadedFiles: true,
      },
    });

    expect(prepareBackupData).toHaveBeenCalledWith(
      '/cache/BackupData',
      {
        library: true,
        settings: true,
        plugins: true,
        downloadedFiles: true,
      },
      3,
    );
    expect(NativeZipArchive.zip).toHaveBeenCalledWith(
      '/storage/Plugins',
      '/cache/BackupData/plugins.zip',
    );
    expect(NativeZipArchive.zip).not.toHaveBeenCalledWith(
      '/storage/Novels',
      expect.any(String),
    );
    expect(NativeZipArchive.zipDirectories).toHaveBeenCalledWith(
      [
        { path: '/cache/BackupData', prefix: '' },
        { path: '/storage/Novels', prefix: 'NovelFiles' },
      ],
      '/cache/BackupData.zip',
    );
  });

  it('loads restored plugins after their archive is extracted', async () => {
    const restoreResult = {
      novelCount: 1,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: ['restored'],
      novelMappings: [],
      restoreRunId: 'restore-run-plugins',
      manifest: {
        appVersion: '2.1.0',
        formatVersion: 2 as const,
        sections: {
          library: true,
          settings: true,
          plugins: true,
          downloadedFiles: false,
        },
      },
    };
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(undefined);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValueOnce([]);

    await restoreBackup({ sourceUri: 'content://backup.zip' });

    expect(NativeZipArchive.unzip).toHaveBeenCalledWith(
      '/cache/BackupData/plugins.zip',
      '/storage/Plugins',
    );
    expect(finalizeRestoredPlugins).toHaveBeenCalledWith(restoreResult);
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith(
      restoreResult.restoreRunId,
    );
    expect(
      jest.mocked(finalizeRestoredPlugins).mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      jest.mocked(NativeZipArchive.unzip).mock.invocationCallOrder[1],
    );
  });
  it('keeps a successful restore successful when mapping cleanup fails', async () => {
    const restoreResult = {
      novelCount: 1,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
      restoreRunId: 'restore-run-cleanup-failure',
      manifest: {
        appVersion: '2.1.0',
        formatVersion: 2 as const,
        sections: {
          library: true,
          settings: false,
          plugins: false,
          downloadedFiles: false,
        },
      },
    };
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(undefined);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValueOnce([]);
    jest
      .mocked(clearRestoreChapterMappings)
      .mockRejectedValueOnce(new Error('mapping cleanup failed'));

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).resolves.toBeUndefined();
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith(
      restoreResult.restoreRunId,
    );
  });

  it('preserves the restore error when mapping cleanup also fails', async () => {
    const restoreResult = {
      novelCount: 1,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
      restoreRunId: 'restore-run-restore-failure',
      manifest: {
        appVersion: '2.1.3',
        formatVersion: 3 as const,
        sections: {
          library: true,
          settings: false,
          plugins: false,
          downloadedFiles: true,
        },
      },
    };
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(
        async path => path !== '/cache/BackupData/NovelFiles',
      );
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(undefined);
    jest
      .mocked(clearRestoreChapterMappings)
      .mockRejectedValueOnce(new Error('mapping cleanup failed'));

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).rejects.toThrow('backupScreen.invalidBackupFolder');
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith(
      restoreResult.restoreRunId,
    );
  });

  it('extracts the v1 downloaded archive into the legacy staging path', async () => {
    const restoreResult = {
      novelCount: 1,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
      restoreRunId: 'restore-run-v1',
      manifest: {
        appVersion: '1.0.0',
        formatVersion: 1 as const,
        sections: {
          library: true,
          settings: true,
          plugins: true,
          downloadedFiles: true,
        },
      },
    };
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(undefined);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValueOnce([]);

    await restoreBackup({ sourceUri: 'content://backup.zip' });

    expect(NativeZipArchive.unzip).toHaveBeenCalledWith(
      '/cache/BackupData/download.zip',
      '/cache/BackupData/RestoredLegacyFiles',
    );
    expect(NativeZipArchive.unzip).not.toHaveBeenCalledWith(
      '/cache/BackupData/novel-files.zip',
      expect.any(String),
    );
    expect(fileSections.restoreLegacyFiles).toHaveBeenCalledWith(
      '/cache/BackupData/RestoredLegacyFiles',
      restoreResult.novelMappings,
      restoreResult.restoreRunId,
    );
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith(
      restoreResult.restoreRunId,
    );
  });

  it('extracts the v2 novel-files archive into the novel staging path', async () => {
    const restoreResult = {
      novelCount: 1,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
      restoreRunId: 'restore-run-v2',
      manifest: {
        appVersion: '2.0.0',
        formatVersion: 2 as const,
        sections: {
          library: true,
          settings: false,
          plugins: true,
          downloadedFiles: true,
        },
      },
    };
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(undefined);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValueOnce([]);

    await restoreBackup({ sourceUri: 'content://backup.zip' });

    expect(NativeZipArchive.unzip).toHaveBeenCalledWith(
      '/cache/BackupData/novel-files.zip',
      '/cache/BackupData/RestoredNovelFiles',
    );
    expect(fileSections.restoreNovelFiles).toHaveBeenCalledWith(
      '/cache/BackupData/RestoredNovelFiles',
      restoreResult.novelMappings,
      restoreResult.restoreRunId,
    );
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith(
      restoreResult.restoreRunId,
    );
  });

  it('restores v3 novel files from the outer archive without nested extraction', async () => {
    const restoreResult = {
      novelCount: 1,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
      restoreRunId: 'restore-run-v3',
      manifest: {
        appVersion: '2.1.3',
        formatVersion: 3 as const,
        novelDataFormat: 2 as const,
        sections: {
          library: true,
          settings: false,
          plugins: true,
          downloadedFiles: true,
        },
      },
    };
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(undefined);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValueOnce([]);

    await restoreBackup({ sourceUri: 'content://backup.zip' });

    expect(NativeZipArchive.unzip).toHaveBeenCalledWith(
      '/cache/BackupData/plugins.zip',
      '/storage/Plugins',
    );
    expect(NativeZipArchive.unzip).not.toHaveBeenCalledWith(
      '/cache/BackupData/novel-files.zip',
      expect.any(String),
    );
    expect(fileSections.restoreNovelFiles).toHaveBeenCalledWith(
      '/cache/BackupData/NovelFiles',
      restoreResult.novelMappings,
      restoreResult.restoreRunId,
    );
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith(
      restoreResult.restoreRunId,
    );
  });
  it('rejects a v3 downloaded-file restore without NovelFiles', async () => {
    const restoreResult = {
      novelCount: 1,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
      restoreRunId: 'restore-run-v3-missing',
      manifest: {
        appVersion: '2.1.3',
        formatVersion: 3 as const,
        sections: {
          library: true,
          settings: false,
          plugins: false,
          downloadedFiles: true,
        },
      },
    };
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(
        async path => path !== '/cache/BackupData/NovelFiles',
      );
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(undefined);

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).rejects.toThrow('backupScreen.invalidBackupFolder');
    expect(finalizeRestoredPlugins).not.toHaveBeenCalled();
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith(
      restoreResult.restoreRunId,
    );
  });
});
