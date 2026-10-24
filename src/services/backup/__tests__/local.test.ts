import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { createBackup } from '../local';
import { prepareBackupData } from '../create';

jest.mock('../cache', () => ({
  CACHE_DIR_PATH: '/cache/BackupData',
  clearBackupCache: jest.fn(),
}));

jest.mock('../create', () => ({
  prepareBackupData: jest.fn(),
}));

jest.mock('../backupResult', () => ({
  getBackupCompletionText: jest.fn(() => 'Backup created'),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  PLUGIN_STORAGE: '/storage/Plugins',
}));

jest.mock('@utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

describe('local backup creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(prepareBackupData).mockReset();
    jest.mocked(NativeZipArchive.zip).mockReset().mockResolvedValue(undefined);
    jest
      .mocked(NativeZipArchive.zipDirectories)
      .mockReset()
      .mockResolvedValue(undefined);
    jest.mocked(NativeFile.copyFile).mockReset().mockResolvedValue(undefined);
  });

  it('creates archives only for selected file sections', async () => {
    jest.mocked(prepareBackupData).mockResolvedValue({
      failedNovelCount: 0,
      failedSectionCount: 0,
    });

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
});
