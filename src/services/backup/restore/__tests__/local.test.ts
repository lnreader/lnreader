import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { clearRestoreChapterMappings } from '@database/queries/NovelRestoreQueries';
import { restoreBackup } from '../local';
import * as fileSections from '../files';
import { finalizeRestoredPlugins, getRestoreCompletionText } from '../result';
import { restoreData } from '../index';
import type {
  BackgroundTaskMetadata,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import type { UnzipStats } from '@modules/native-zip-archive/src/NativeZipArchiveModule';

const createProgressCapture = () => {
  let metadata: BackgroundTaskMetadata = {
    name: 'LOCAL_RESTORE',
    isRunning: true,
    progress: undefined,
    progressText: undefined,
  };
  const progressValues: number[] = [];
  const setMeta: TaskProgressUpdater = transform => {
    metadata = transform(metadata);
    if (metadata.progress !== undefined) {
      progressValues.push(metadata.progress);
    }
  };
  return { progressValues, setMeta };
};

const unzipStats: UnzipStats = {
  fileCount: 7,
  compressedBytes: 420,
  uncompressedBytes: 840,
  largestUncompressedEntryBytes: 300,
  elapsedMs: 1.5,
  categories: {
    NovelAndChapters: {
      fileCount: 2,
      compressedBytes: 120,
      uncompressedBytes: 240,
    },
    Covers: { fileCount: 1, compressedBytes: 30, uncompressedBytes: 60 },
    NovelFiles: { fileCount: 3, compressedBytes: 240, uncompressedBytes: 480 },
    other: { fileCount: 1, compressedBytes: 30, uncompressedBytes: 60 },
  },
};

jest.mock('@database/queries/NovelRestoreQueries', () => ({
  clearRestoreChapterMappings: jest.fn(),
  getRestoreChapterMappings: jest.fn(),
}));

jest.mock('../files', () => {
  const actual = jest.requireActual('../files');
  return {
    ...actual,
    restoreLegacyFiles: jest.fn(),
    restoreNovelFiles: jest.fn(),
  };
});

jest.mock('../../cache', () => ({
  CACHE_DIR_PATH: '/cache/BackupData',
  clearBackupCache: jest.fn(),
}));

jest.mock('../index', () => ({
  clearRestoreChapterMappingsSafely: jest.fn(async (restoreRunId: string) => {
    try {
      await jest
        .requireMock('@database/queries/NovelRestoreQueries')
        .clearRestoreChapterMappings(restoreRunId);
    } catch {
      // Match the production helper's best-effort cleanup.
    }
  }),
  restoreData: jest.fn(),
}));

jest.mock('../result', () => ({
  finalizeRestoredPlugins: jest.fn(),
  getRestoreCompletionText: jest.fn(),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  PLUGIN_STORAGE: '/storage/Plugins',
  ROOT_STORAGE: '/storage',
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

describe('local backup restore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  beforeEach(() => {
    jest.mocked(restoreData).mockReset();
    jest.mocked(NativeZipArchive.zip).mockReset().mockResolvedValue(undefined);
    jest
      .mocked(NativeZipArchive.zipDirectories)
      .mockReset()
      .mockResolvedValue(undefined);
    jest
      .mocked(NativeZipArchive.unzip)
      .mockReset()
      .mockResolvedValue(unzipStats);
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
    jest
      .mocked(restoreData)
      .mockImplementationOnce(async (_cacheDirPath, reporter) => {
        reporter?.('manifest', 1, 'manifest', true);
        reporter?.('novels', 0.25, 'novels', true);
        reporter?.('novels', 0.75, 'novels', true);
        reporter?.('categories', 1, 'categories', true);
        reporter?.('settings', 1, 'settings', true);
        reporter?.('plugins', 1, 'plugins', true);
        return restoreResult;
      });
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.copyFile).mockResolvedValue(undefined);
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(unzipStats);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValueOnce([]);

    const capture = createProgressCapture();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await restoreBackup({ sourceUri: 'content://backup.zip' }, capture.setMeta);

    expect(NativeZipArchive.unzip).toHaveBeenCalledWith(
      '/cache/BackupData/plugins.zip',
      '/storage/Plugins',
    );
    expect(finalizeRestoredPlugins).toHaveBeenCalledWith(restoreResult);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `local:outer-unzip:done ${JSON.stringify(unzipStats)}`,
      ),
    );
    expect(
      capture.progressValues.some(value => Math.abs(value - 0.09) < 0.000001),
    ).toBe(true);
    expect(
      capture.progressValues.some(value => Math.abs(value - 0.3) < 0.000001),
    ).toBe(true);
    const novelProgress = capture.progressValues.filter(
      value => value > 0.302 && value < 0.982,
    );
    expect(new Set(novelProgress).size).toBeGreaterThan(1);
    expect(capture.progressValues[capture.progressValues.length - 1]).toBe(1);
    logSpy.mockRestore();
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
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(unzipStats);
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
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(unzipStats);
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
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(unzipStats);
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
      expect.any(Function),
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
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(unzipStats);
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
      expect.any(Function),
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
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(unzipStats);
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
      expect.any(Function),
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
    jest.mocked(NativeZipArchive.unzip).mockResolvedValue(unzipStats);
    const capture = createProgressCapture();

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }, capture.setMeta),
    ).rejects.toThrow('backupScreen.invalidBackupFolder');
    expect(capture.progressValues.every(value => value < 1)).toBe(true);
    expect(finalizeRestoredPlugins).not.toHaveBeenCalled();
    expect(clearRestoreChapterMappings).toHaveBeenCalledWith(
      restoreResult.restoreRunId,
    );
  });
  it('does not report completion when plugin finalization fails', async () => {
    const restoreResult = {
      novelCount: 0,
      failedNovelCount: 0,
      categoryCount: 0,
      failedCategoryCount: 0,
      settingsRestored: true,
      failedSectionCount: 0,
      pluginIds: [],
      novelMappings: [],
      restoreRunId: 'restore-run-finalization-failure',
      manifest: {
        appVersion: '2.1.3',
        formatVersion: 3 as const,
        sections: {
          library: false,
          settings: false,
          plugins: false,
          downloadedFiles: false,
        },
      },
    };
    const failure = new Error('plugin finalization failed');
    jest.mocked(restoreData).mockResolvedValueOnce(restoreResult);
    jest.mocked(finalizeRestoredPlugins).mockRejectedValueOnce(failure);
    const capture = createProgressCapture();

    await expect(
      restoreBackup({ sourceUri: 'content://backup.zip' }, capture.setMeta),
    ).rejects.toBe(failure);

    expect(capture.progressValues.every(value => value < 1)).toBe(true);
    expect(getRestoreCompletionText).not.toHaveBeenCalled();
  });

  it('does not report success when the restore pipeline fails and resets benchmark timing before a retry', async () => {
    const interruption = new Error('restore interrupted');
    let completionUpdateCount = 0;
    const setMeta: TaskProgressUpdater = transform => {
      const next = transform({
        name: 'LOCAL_RESTORE',
        isRunning: true,
        progress: undefined,
        progressText: undefined,
      });
      if (next.completionText) {
        completionUpdateCount++;
      }
    };
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    for (let attempt = 0; attempt < 2; attempt++) {
      jest.mocked(restoreData).mockRejectedValueOnce(interruption);
      await expect(
        restoreBackup({ sourceUri: 'content://backup.zip' }, setMeta),
      ).rejects.toBe(interruption);
    }

    const startEvents = logSpy.mock.calls
      .map(([message]) => String(message))
      .filter(message => message.includes('local:start'));
    expect(startEvents).toHaveLength(2);
    expect(startEvents[1]).not.toContain('duration:');
    expect(getRestoreCompletionText).not.toHaveBeenCalled();
    expect(completionUpdateCount).toBe(0);
    logSpy.mockRestore();
  });
});
