import { exists } from '@api/drive';
import type { DriveFile } from '@api/drive/types';
import { download } from '@api/drive/request';
import type {
  BackgroundTaskMetadata,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { CACHE_DIR_PATH, clearBackupCache } from '../../cache';
import { ZipBackupName } from '../../types';
import { restoreNovelFiles } from '../files';

import { driveRestore } from '../drive';
import { restoreData } from '../index';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
  type RestoreResult,
} from '../result';
import type { RestoreProgressReporter } from '../progress';

jest.mock('@api/drive', () => ({ exists: jest.fn() }));
jest.mock('@api/drive/request', () => ({ download: jest.fn() }));
jest.mock('../../cache', () => ({
  CACHE_DIR_PATH: '/cache/BackupData',
  clearBackupCache: jest.fn(),
}));
jest.mock('../files', () => ({
  getLegacyFilesRestorePath: jest.fn(() => '/cache/legacy-files'),
  getNovelFilesRestorePath: jest.fn(() => '/cache/novel-files'),
  restoreLegacyFiles: jest.fn(),
  restoreNovelFiles: jest.fn(),
}));
jest.mock('../index', () => ({
  clearRestoreChapterMappingsSafely: jest.fn(),
  restoreData: jest.fn(),
}));
jest.mock('../result', () => ({
  finalizeRestoredPlugins: jest.fn(),
  getRestoreCompletionText: jest.fn(() => 'completed'),
}));
jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));
jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  PLUGIN_STORAGE: '/storage/Plugins',
}));

const dataFile = { id: 'data-file', name: 'data.zip' } as DriveFile;
const backupFolder = { id: 'backup-folder', name: 'backup' } as DriveFile;

const createRestoreResult = (
  plugins: boolean,
  downloadedFiles = false,
  formatVersion: 1 | 2 | 3 = 3,
  novelMappings: RestoreResult['novelMappings'] = [],
): RestoreResult => ({
  novelCount: 0,
  failedNovelCount: 0,
  categoryCount: 0,
  failedCategoryCount: 0,
  settingsRestored: true,
  failedSectionCount: 0,
  pluginIds: plugins ? ['restored-plugin'] : [],
  novelMappings,
  restoreRunId: 'drive-restore-run',
  manifest: {
    appVersion: '2.1.3',
    formatVersion,
    novelDataFormat: 2,
    sections: {
      library: downloadedFiles,
      settings: false,
      plugins,
      downloadedFiles,
    },
  },
});

const reportRestoreStages = (reporter: RestoreProgressReporter | undefined) => {
  reporter?.('manifest', 1, 'manifest', true);
  reporter?.('novels', 1, 'novels', true);
  reporter?.('categories', 1, 'categories', true);
  reporter?.('settings', 1, 'settings', true);
  reporter?.('plugins', 1, 'plugins', true);
};

const createProgressCapture = () => {
  let metadata: BackgroundTaskMetadata = {
    name: 'DRIVE_RESTORE',
    isRunning: false,
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
  return { progressValues, setMeta, getMetadata: () => metadata };
};

describe('Drive restore progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(exists).mockResolvedValue(dataFile);
    jest.mocked(download).mockResolvedValue('');
    jest.mocked(clearBackupCache).mockResolvedValue(undefined);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValue([]);
  });

  it('keeps remote retrieval and later phases monotonic through completion', async () => {
    const result = createRestoreResult(false);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    const capture = createProgressCapture();

    await driveRestore(backupFolder, capture.setMeta);

    expect(capture.progressValues[0]).toBe(0);
    expect(
      capture.progressValues.some(value => Math.abs(value - 0.3) < 0.000001),
    ).toBe(true);
    expect(capture.progressValues[capture.progressValues.length - 1]).toBe(1);
    expect(
      capture.progressValues.every(
        (value, index) =>
          index === 0 || value >= capture.progressValues[index - 1],
      ),
    ).toBe(true);
    expect(capture.getMetadata().isRunning).toBe(false);
    expect(capture.getMetadata().completionText).toBe('completed');
    expect(download).toHaveBeenCalledWith(dataFile, CACHE_DIR_PATH);
  });

  it('does not report completion when a selected archive is missing', async () => {
    const result = createRestoreResult(true);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    jest
      .mocked(exists)
      .mockImplementation(async name =>
        name === ZipBackupName.DATA ? dataFile : undefined,
      );
    const capture = createProgressCapture();

    await expect(driveRestore(backupFolder, capture.setMeta)).rejects.toThrow(
      'backupScreen.invalidBackupFolder',
    );

    expect(capture.progressValues.length).toBeGreaterThan(0);
    expect(Math.max(...capture.progressValues)).toBeLessThan(1);
    expect(finalizeRestoredPlugins).not.toHaveBeenCalled();
    expect(getRestoreCompletionText).not.toHaveBeenCalled();
  });
  it('restores selected format-2 archives before finalizing plugins', async () => {
    const mappings = [
      { pluginId: 'plugin-a', backupNovelId: 12, restoredNovelId: 42 },
    ];
    const result = createRestoreResult(true, true, 2, mappings);
    const pluginFile = {
      id: 'plugins-file',
      name: ZipBackupName.PLUGINS,
    } as DriveFile;
    const novelFilesFile = {
      id: 'novel-files-file',
      name: ZipBackupName.NOVEL_FILES,
    } as DriveFile;
    const files: Record<string, DriveFile> = {
      [ZipBackupName.DATA]: dataFile,
      [ZipBackupName.PLUGINS]: pluginFile,
      [ZipBackupName.NOVEL_FILES]: novelFilesFile,
    };
    jest.mocked(exists).mockImplementation(async name => files[name]);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    const capture = createProgressCapture();

    await driveRestore(backupFolder, capture.setMeta);

    expect(download).toHaveBeenCalledWith(dataFile, CACHE_DIR_PATH);
    expect(download).toHaveBeenCalledWith(pluginFile, '/storage/Plugins');
    expect(download).toHaveBeenCalledWith(novelFilesFile, '/cache/novel-files');
    expect(restoreNovelFiles).toHaveBeenCalledWith(
      '/cache/novel-files',
      mappings,
      result.restoreRunId,
      expect.any(Function),
    );
    expect(
      jest.mocked(restoreNovelFiles).mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      Math.max(...jest.mocked(download).mock.invocationCallOrder),
    );
    expect(finalizeRestoredPlugins).toHaveBeenCalledWith(result);
    expect(
      jest.mocked(finalizeRestoredPlugins).mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      Math.max(...jest.mocked(download).mock.invocationCallOrder),
    );
    expect(
      jest.mocked(finalizeRestoredPlugins).mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      jest.mocked(restoreNovelFiles).mock.invocationCallOrder[0],
    );
    expect(
      jest.mocked(getRestoreCompletionText).mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      jest.mocked(finalizeRestoredPlugins).mock.invocationCallOrder[0],
    );
    expect(capture.getMetadata().isRunning).toBe(false);
    expect(capture.getMetadata().completionText).toBe('completed');
  });

  it('rejects a missing data archive before clearing the cache or downloading', async () => {
    jest.mocked(exists).mockResolvedValue(undefined);
    const capture = createProgressCapture();

    await expect(driveRestore(backupFolder, capture.setMeta)).rejects.toThrow(
      'backupScreen.invalidBackupFolder',
    );

    expect(exists).toHaveBeenCalledWith(
      ZipBackupName.DATA,
      false,
      backupFolder.id,
    );
    expect(clearBackupCache).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(restoreData).not.toHaveBeenCalled();
  });
});
