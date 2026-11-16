import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { createBackup, restoreBackup } from '../local';
import { finalizeRestoredPlugins } from '../restoreResult';
import {
  assertSupportedBackupArchive,
  clearBackupCache,
  prepareBackupData,
  restoreData,
} from '../utils';

jest.mock('../utils', () => ({
  assertSupportedBackupArchive: jest.fn(),
  CACHE_DIR_PATH: '/cache/BackupData',
  clearBackupCache: jest.fn(),
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
  it('creates archives only for selected file sections', async () => {
    jest.mocked(prepareBackupData).mockResolvedValue({
      failedNovelCount: 0,
      failedSectionCount: 0,
    });
    jest.mocked(NativeZipArchive.zip).mockResolvedValue(undefined);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest
      .mocked(NativeFile.readDir)
      .mockResolvedValue([
        { name: 'index.js', path: '/storage/Plugins/a', isDirectory: false },
      ]);

    await createBackup({
      destinationUri: 'content://backup.zip',
      options: {
        library: true,
        settings: true,
        plugins: true,
        downloadedFiles: false,
      },
    });

    expect(prepareBackupData).toHaveBeenCalledWith('/cache/BackupData', {
      library: true,
      settings: true,
      plugins: true,
      downloadedFiles: false,
    });
    expect(NativeZipArchive.zip).toHaveBeenCalledWith(
      '/storage/Plugins',
      '/cache/BackupData/plugins.zip',
    );
    expect(NativeZipArchive.zip).not.toHaveBeenCalledWith(
      '/storage/Novels',
      expect.any(String),
    );
    expect(NativeZipArchive.zip).toHaveBeenCalledWith(
      '/cache/BackupData',
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
    expect(
      jest.mocked(finalizeRestoredPlugins).mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      jest.mocked(NativeZipArchive.unzip).mock.invocationCallOrder[1],
    );
  });

  it('rejects an unsupported backup before copying or changing anything', async () => {
    jest
      .mocked(assertSupportedBackupArchive)
      .mockRejectedValueOnce(new Error('backupScreen.unsupportedBackupFormat'));
    jest.mocked(NativeFile.copyFile).mockClear();
    jest.mocked(clearBackupCache).mockClear();
    jest.mocked(NativeZipArchive.unzip).mockClear();
    jest.mocked(restoreData).mockClear();

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).rejects.toThrow('backupScreen.unsupportedBackupFormat');

    expect(assertSupportedBackupArchive).toHaveBeenCalledWith(
      'content://backup.zip',
    );
    expect(clearBackupCache).not.toHaveBeenCalled();
    expect(NativeFile.copyFile).not.toHaveBeenCalled();
    expect(NativeZipArchive.unzip).not.toHaveBeenCalled();
    expect(restoreData).not.toHaveBeenCalled();
  });

  it('archives an empty or missing section through a marker file', async () => {
    jest.mocked(prepareBackupData).mockResolvedValue({
      failedNovelCount: 0,
      failedSectionCount: 0,
    });
    jest.mocked(NativeZipArchive.zip).mockResolvedValue(undefined);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(
        async path => path !== '/storage/Novels' && !path.includes('Empty'),
      );
    jest
      .mocked(NativeFile.readDir)
      .mockImplementation(async path =>
        path === '/storage/Plugins'
          ? [{ name: 'x', path: '/storage/Plugins/x', isDirectory: true }]
          : [],
      );

    await createBackup({
      destinationUri: 'content://backup.zip',
      options: {
        library: true,
        settings: true,
        plugins: true,
        downloadedFiles: true,
      },
    });

    const zipped = jest.mocked(NativeZipArchive.zip).mock.calls;
    expect(zipped).toContainEqual([
      '/mock/caches/BackupEmptySection-plugins.zip',
      '/cache/BackupData/plugins.zip',
    ]);
    expect(zipped).toContainEqual([
      '/mock/caches/BackupEmptySection-novel-files.zip',
      '/cache/BackupData/novel-files.zip',
    ]);
    expect(NativeFile.writeFile).toHaveBeenCalledWith(
      '/mock/caches/BackupEmptySection-plugins.zip/.lnreader-empty-section',
      '',
    );
  });

  it('restores an empty section archive that this Android cannot open', async () => {
    jest.mocked(restoreData).mockResolvedValueOnce({
      novelCount: 0,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
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
    });
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockImplementation(async source => {
      if (source.endsWith('plugins.zip')) {
        throw new Error('No entries');
      }
    });
    jest.mocked(finalizeRestoredPlugins).mockResolvedValueOnce([]);

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).resolves.toBeUndefined();
    expect(finalizeRestoredPlugins).toHaveBeenCalled();
  });

  it('rejects a restore whose selected section archive is absent', async () => {
    jest.mocked(restoreData).mockResolvedValueOnce({
      novelCount: 0,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
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
    });
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => !path.endsWith('plugins.zip'));
    jest.mocked(NativeZipArchive.unzip).mockClear();
    jest.mocked(finalizeRestoredPlugins).mockClear();
    jest.mocked(finalizeRestoredPlugins).mockResolvedValueOnce([]);

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).rejects.toThrow();
    expect(finalizeRestoredPlugins).not.toHaveBeenCalled();
  });
});
