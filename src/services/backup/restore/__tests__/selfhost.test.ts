import { download } from '@api/remote';
import type {
  BackgroundTaskMetadata,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { CACHE_DIR_PATH, clearBackupCache } from '../../cache';
import { ZipBackupName } from '../../types';
import { restoreLegacyFiles, restoreNovelFiles } from '../files';
import { selfHostRestore } from '../selfhost';

import { restoreData } from '../index';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
  type RestoreResult,
} from '../result';
import type { RestoreProgressReporter } from '../progress';

jest.mock('@api/remote', () => ({ download: jest.fn() }));
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

const backupFolder = 'backup-folder';
const host = 'https://example.invalid';
const restoreDataFor = (
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
  restoreRunId: 'selfhost-restore-run',
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
    name: 'SELF_HOST_RESTORE',
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

describe('self-host restore progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(download).mockResolvedValue('');
    jest.mocked(clearBackupCache).mockResolvedValue(undefined);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValue([]);
  });

  it('keeps remote retrieval and later phases monotonic through completion', async () => {
    const result = restoreDataFor(false);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    const capture = createProgressCapture();

    await selfHostRestore({ host, backupFolder }, capture.setMeta);

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
    expect(download).toHaveBeenCalledWith(
      host,
      backupFolder,
      ZipBackupName.DATA,
      CACHE_DIR_PATH,
    );
  });

  it('does not report completion when a selected archive download fails', async () => {
    const mappings = [
      { pluginId: 'plugin-a', backupNovelId: 12, restoredNovelId: 42 },
    ];
    const result = restoreDataFor(true, true, 2, mappings);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    jest.mocked(download).mockImplementation(async (_host, _folder, name) => {
      if (name === ZipBackupName.NOVEL_FILES) {
        throw new Error('selected archive download failed');
      }
      return '';
    });
    const capture = createProgressCapture();

    await expect(
      selfHostRestore({ host, backupFolder }, capture.setMeta),
    ).rejects.toThrow('selected archive download failed');

    expect(download).toHaveBeenCalledWith(
      host,
      backupFolder,
      ZipBackupName.NOVEL_FILES,
      '/cache/novel-files',
    );
    expect(restoreNovelFiles).not.toHaveBeenCalled();
    expect(capture.progressValues.length).toBeGreaterThan(0);
    expect(Math.max(...capture.progressValues)).toBeLessThan(1);
    expect(finalizeRestoredPlugins).not.toHaveBeenCalled();
    expect(getRestoreCompletionText).not.toHaveBeenCalled();
  });

  it('restores selected format-2 archives before finalizing plugins', async () => {
    const mappings = [
      { pluginId: 'plugin-a', backupNovelId: 12, restoredNovelId: 42 },
    ];
    const result = restoreDataFor(true, true, 2, mappings);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    const capture = createProgressCapture();

    await selfHostRestore({ host, backupFolder }, capture.setMeta);

    expect(download).toHaveBeenCalledWith(
      host,
      backupFolder,
      ZipBackupName.PLUGINS,
      '/storage/Plugins',
    );
    expect(download).toHaveBeenCalledWith(
      host,
      backupFolder,
      ZipBackupName.NOVEL_FILES,
      '/cache/novel-files',
    );
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

  it('restores format-1 downloads from the legacy staging path', async () => {
    const mappings = [
      { pluginId: 'plugin-a', backupNovelId: 12, restoredNovelId: 42 },
    ];
    const result = restoreDataFor(false, true, 1, mappings);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    const capture = createProgressCapture();

    await selfHostRestore({ host, backupFolder }, capture.setMeta);

    expect(download).toHaveBeenCalledWith(
      host,
      backupFolder,
      ZipBackupName.DOWNLOAD,
      '/cache/legacy-files',
    );
    expect(restoreLegacyFiles).toHaveBeenCalledWith(
      '/cache/legacy-files',
      mappings,
      result.restoreRunId,
      expect.any(Function),
    );
    expect(restoreNovelFiles).not.toHaveBeenCalled();
    expect(capture.getMetadata().completionText).toBe('completed');
  });
});
