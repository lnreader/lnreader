import { getString } from '@i18n/translations';
import NativeFile from '@modules/native-file';
import { BackupEntryName, ZipBackupName } from '../types';
import { getSelectedBackupFileSections } from '../fileSections';
import { CACHE_DIR_PATH } from '../cache';
import {
  getLegacyFilesRestorePath,
  getNovelFilesRestorePath,
  restoreLegacyFiles,
  restoreNovelFiles,
} from './files';
import { restoreData, clearRestoreChapterMappingsSafely } from './index';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
  type RestoreResult,
} from './result';
import {
  createRestoreProgressReporter,
  type RestoreProgressReporter,
} from './progress';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';

type RestoreSource = {
  kind: 'local' | 'remote';
  prepare: (report: RestoreProgressReporter | undefined) => Promise<void>;
  loadArchive: (name: ZipBackupName, destination: string) => Promise<void>;
  benchmarkLog?: (message: string) => void;
};

export const runRestore = async (
  source: RestoreSource,
  setMeta?: TaskProgressUpdater,
): Promise<void> => {
  const progressReporter = createRestoreProgressReporter(setMeta, source.kind);
  let restoreResult: RestoreResult | undefined;

  setMeta?.(meta => ({ ...meta, isRunning: true }));

  try {
    await source.prepare(progressReporter);
    restoreResult = await restoreData(
      CACHE_DIR_PATH,
      progressReporter,
      source.benchmarkLog,
    );
    source.benchmarkLog?.('local:restore-data:done');

    const selectedFilesText = getString('backupScreen.restoringSelectedFiles');
    const publishSelectedFilesProgress = (fraction: number, force = false) => {
      progressReporter?.('selectedFiles', fraction, selectedFilesText, force);
    };
    const reportSelectedFileMoves = (completed: number, total: number) => {
      publishSelectedFilesProgress(
        0.5 + 0.5 * (total > 0 ? completed / total : 1),
        completed >= total,
      );
    };
    publishSelectedFilesProgress(0, true);

    if (restoreResult.manifest.formatVersion === 1) {
      const legacyFilesRestorePath = getLegacyFilesRestorePath(CACHE_DIR_PATH);
      await source.loadArchive(ZipBackupName.DOWNLOAD, legacyFilesRestorePath);
      publishSelectedFilesProgress(0.5, true);
      await restoreLegacyFiles(
        legacyFilesRestorePath,
        restoreResult.novelMappings,
        restoreResult.restoreRunId,
        reportSelectedFileMoves,
      );
    } else {
      const novelFilesRestorePath = getNovelFilesRestorePath(CACHE_DIR_PATH);
      const sections = getSelectedBackupFileSections(
        restoreResult.manifest.sections,
        source.kind === 'local' ? restoreResult.manifest.formatVersion : 2,
      );
      if (sections.length === 0) {
        publishSelectedFilesProgress(0.5, true);
      }

      let novelFilesSource: string | undefined;
      if (
        source.kind === 'local' &&
        restoreResult.manifest.formatVersion === 3 &&
        restoreResult.manifest.sections.downloadedFiles
      ) {
        novelFilesSource = `${CACHE_DIR_PATH}/${BackupEntryName.NOVEL_FILES}`;
        if (!(await NativeFile.exists(novelFilesSource))) {
          throw new Error(getString('backupScreen.invalidBackupFolder'));
        }
      }

      for (const [index, section] of sections.entries()) {
        const destination =
          section.archiveName === ZipBackupName.NOVEL_FILES
            ? novelFilesRestorePath
            : section.storagePath;
        await source.loadArchive(section.archiveName, destination);
        publishSelectedFilesProgress(
          0.5 * ((index + 1) / sections.length),
          index + 1 === sections.length,
        );
      }
      source.benchmarkLog?.('local:selected-archives:done');

      if (restoreResult.manifest.sections.downloadedFiles) {
        await restoreNovelFiles(
          novelFilesSource ?? novelFilesRestorePath,
          restoreResult.novelMappings,
          restoreResult.restoreRunId,
          reportSelectedFileMoves,
        );
      } else {
        publishSelectedFilesProgress(1, true);
      }
    }

    source.benchmarkLog?.('local:downloaded-files:done');
    source.benchmarkLog?.('local:selected-files:done');

    progressReporter?.(
      'finalize',
      0,
      getString('backupScreen.finalizingRestore'),
      true,
    );
    const missingPluginIds = await finalizeRestoredPlugins(restoreResult);
    const completionText = getRestoreCompletionText(
      restoreResult,
      missingPluginIds,
    );
    progressReporter?.('finalize', 1, completionText, true);
    source.benchmarkLog?.('local:finalize:done');

    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
      progressText: completionText,
      completionText,
    }));
  } finally {
    if (restoreResult) {
      await clearRestoreChapterMappingsSafely(restoreResult.restoreRunId);
    }
  }
};
