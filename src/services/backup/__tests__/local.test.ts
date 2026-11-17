import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { createBackup, restoreBackup } from '../local';
import { finalizeRestoredPlugins, type RestoreResult } from '../restoreResult';
import {
  assertSupportedBackupArchive,
  clearRestoreWorkingFiles,
  clearRestoreWorkingFilesAfterRestore,
  prepareBackupData,
  restoreData,
} from '../utils';

jest.mock('../utils', () => ({
  assertSupportedBackupArchive: jest.fn(),
  CACHE_DIR_PATH: '/cache/BackupData',
  RESTORE_SOURCE_COPY_PATH: '/cache/BackupData-source.zip',
  clearRestoreWorkingFiles: jest.fn(),
  clearRestoreWorkingFilesAfterRestore: jest.fn(),
  isPickedBackupPath: jest.fn(() => false),
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
});

const restoreResultFor = (
  sections: RestoreResult['manifest']['sections'],
): RestoreResult => ({
  novelCount: 1,
  failedNovelCount: 0,
  categoryCount: 0,
  failedCategoryCount: 0,
  settingsRestored: true,
  failedSectionCount: 0,
  pluginIds: ['restored'],
  novelMappings: [],
  manifest: { appVersion: '2.1.0', formatVersion: 2, sections },
});

const withPlugins = {
  library: true,
  settings: true,
  plugins: true,
  downloadedFiles: false,
};

describe('local restore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(NativeZipArchive.openArchive).mockResolvedValue(7);
    jest
      .mocked(NativeZipArchive.archiveEntryExists)
      .mockImplementation(async (_, path) => path === 'plugins.zip');
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(undefined);
    jest.mocked(NativeFile.exists).mockResolvedValue(false);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValue([]);
  });

  it('reads the picked backup in place instead of copying and unpacking it', async () => {
    jest.mocked(restoreData).mockImplementationOnce(async source => {
      expect(typeof source).not.toBe('string');
      await (source as Exclude<typeof source, string>).readFile(
        'Category.json',
      );
      return restoreResultFor(withPlugins);
    });

    await restoreBackup({ sourceUri: 'content://backup.zip' });

    expect(NativeZipArchive.openArchive).toHaveBeenCalledWith(
      'content://backup.zip',
    );
    expect(NativeZipArchive.readArchiveFile).toHaveBeenCalledWith(
      7,
      'Category.json',
    );
    expect(NativeFile.copyFile).not.toHaveBeenCalled();
    expect(NativeZipArchive.unzip).not.toHaveBeenCalledWith(
      expect.stringContaining('backup.zip'),
      expect.any(String),
    );
    expect(NativeZipArchive.closeArchive).toHaveBeenCalledWith(7);
  });

  it('takes a section archive out of the backup, extracts it and deletes it', async () => {
    const restoreResult = restoreResultFor(withPlugins);
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);

    await restoreBackup({ sourceUri: 'content://backup.zip' });

    expect(NativeZipArchive.extractArchiveFile).toHaveBeenCalledWith(
      7,
      'plugins.zip',
      '/cache/BackupData/plugins.zip',
    );
    expect(NativeZipArchive.unzip).toHaveBeenCalledWith(
      '/cache/BackupData/plugins.zip',
      '/storage/Plugins',
    );
    expect(NativeFile.unlink).toHaveBeenCalledWith(
      '/cache/BackupData/plugins.zip',
    );
    expect(finalizeRestoredPlugins).toHaveBeenCalledWith(restoreResult);
    expect(
      jest.mocked(finalizeRestoredPlugins).mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      jest.mocked(NativeZipArchive.unzip).mock.invocationCallOrder[0],
    );
  });

  it('reads a local copy when the picked backup cannot be read in place', async () => {
    jest
      .mocked(NativeZipArchive.openArchive)
      .mockRejectedValueOnce(
        Object.assign(new Error('stream only'), { code: 'NOT_SEEKABLE' }),
      )
      .mockResolvedValueOnce(9);
    jest
      .mocked(restoreData)
      .mockResolvedValueOnce(restoreResultFor(withPlugins));

    await restoreBackup({ sourceUri: 'content://stream.zip' });

    expect(NativeFile.copyFile).toHaveBeenCalledWith(
      'content://stream.zip',
      '/cache/BackupData-source.zip',
    );
    expect(NativeZipArchive.openArchive).toHaveBeenLastCalledWith(
      '/cache/BackupData-source.zip',
    );
    expect(NativeZipArchive.closeArchive).toHaveBeenCalledWith(9);
    expect(clearRestoreWorkingFilesAfterRestore).toHaveBeenCalledWith(
      'content://stream.zip',
    );
  });

  it('fails without copying when the picked backup is not a readable archive', async () => {
    jest.mocked(NativeZipArchive.openArchive).mockRejectedValueOnce(
      Object.assign(new Error('Not a zip archive'), {
        code: 'OPEN_ARCHIVE_FAILED',
      }),
    );

    await expect(
      restoreBackup({ sourceUri: 'content://broken.zip' }),
    ).rejects.toThrow('Not a zip archive');
    expect(NativeFile.copyFile).not.toHaveBeenCalled();
    expect(restoreData).not.toHaveBeenCalled();
  });

  it('restores an empty section archive that this Android cannot open', async () => {
    jest
      .mocked(restoreData)
      .mockResolvedValueOnce(restoreResultFor(withPlugins));
    jest.mocked(NativeZipArchive.unzip).mockImplementation(async source => {
      if (source.endsWith('plugins.zip')) {
        throw new Error('No entries');
      }
    });

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).resolves.toBeUndefined();
    expect(finalizeRestoredPlugins).toHaveBeenCalled();
  });

  it('rejects a restore whose selected section archive is absent', async () => {
    jest
      .mocked(restoreData)
      .mockResolvedValueOnce(restoreResultFor(withPlugins));
    jest.mocked(NativeZipArchive.archiveEntryExists).mockResolvedValue(false);

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).rejects.toThrow('backupScreen.invalidBackupFolder');
    expect(finalizeRestoredPlugins).not.toHaveBeenCalled();
  });

  it('clears working files before and after a restore that succeeds', async () => {
    jest
      .mocked(restoreData)
      .mockResolvedValueOnce(restoreResultFor(withPlugins));

    await restoreBackup({ sourceUri: 'content://backup.zip' });

    expect(clearRestoreWorkingFiles).toHaveBeenCalledWith(
      'content://backup.zip',
    );
    expect(
      jest.mocked(clearRestoreWorkingFiles).mock.invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(NativeZipArchive.openArchive).mock.invocationCallOrder[0],
    );
    expect(clearRestoreWorkingFilesAfterRestore).toHaveBeenCalledWith(
      'content://backup.zip',
    );
    expect(
      jest.mocked(clearRestoreWorkingFilesAfterRestore).mock
        .invocationCallOrder[0],
    ).toBeGreaterThan(
      jest.mocked(NativeZipArchive.closeArchive).mock.invocationCallOrder[0],
    );
  });

  it('clears working files after a restore that fails part-way', async () => {
    jest.mocked(restoreData).mockRejectedValueOnce(new Error('disk full'));

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).rejects.toThrow('disk full');

    expect(NativeZipArchive.closeArchive).toHaveBeenCalledWith(7);
    expect(clearRestoreWorkingFilesAfterRestore).toHaveBeenCalledWith(
      'content://backup.zip',
    );
  });

  it('rejects an unsupported backup before copying or changing anything, then clears working files', async () => {
    jest
      .mocked(assertSupportedBackupArchive)
      .mockRejectedValueOnce(new Error('backupScreen.unsupportedBackupFormat'));

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }),
    ).rejects.toThrow('backupScreen.unsupportedBackupFormat');

    expect(assertSupportedBackupArchive).toHaveBeenCalledWith(
      'content://backup.zip',
    );
    expect(NativeZipArchive.openArchive).not.toHaveBeenCalled();
    expect(NativeFile.copyFile).not.toHaveBeenCalled();
    expect(NativeZipArchive.unzip).not.toHaveBeenCalled();
    expect(restoreData).not.toHaveBeenCalled();
    expect(clearRestoreWorkingFilesAfterRestore).toHaveBeenCalledWith(
      'content://backup.zip',
    );
  });
});
