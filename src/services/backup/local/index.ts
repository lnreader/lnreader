import {
  CACHE_DIR_PATH,
  clearRestoreChapterMappingsSafely,
  clearBackupCache,
  prepareBackupData,
  restoreData,
} from '../utils';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
  type RestoreResult,
} from '../restoreResult';
import { getBackupCompletionText } from '../backupResult';
import NativeZipArchive from '@modules/native-zip-archive';
import { BackupEntryName, ZipBackupName } from '../types';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import { sleep } from '@utils/sleep';
import { NOVEL_STORAGE } from '@utils/Storages';
import {
  getLegacyFilesRestorePath,
  getNovelFilesRestorePath,
  getSelectedBackupFileSections,
  restoreLegacyFiles,
  restoreNovelFiles,
} from '../fileSections';
import { resolveBackupOptions, type BackupOptions } from '../options';

const logRestoreBenchmark = (message: string) => {
  if (!__DEV__) {
    return;
  }
  // Benchmark output is consumed from the Metro client log.
  // eslint-disable-next-line no-console
  console.log(
    `[restore-benchmark] ${new Date().toISOString()} ${performance
      .now()
      .toFixed(3)} ${message}`,
  );
};

export const createBackup = async (
  {
    destinationUri,
    options: requestedOptions,
  }: { destinationUri: string; options?: BackupOptions },
  setMeta?: TaskProgressUpdater,
) => {
  try {
    const options = resolveBackupOptions(requestedOptions);
    setMeta?.(meta => ({
      ...meta,
      isRunning: true,
      progress: 0 / 4,
      progressText: getString('backupScreen.preparingData'),
    }));

    const backupResult = await prepareBackupData(CACHE_DIR_PATH, options, 3);

    setMeta?.(meta => ({
      ...meta,
      progress: 1 / 4,
      progressText: getString('backupScreen.preparingSelectedFiles'),
    }));

    await sleep(200);

    for (const section of getSelectedBackupFileSections(options)) {
      await NativeZipArchive.zip(
        section.storagePath,
        `${CACHE_DIR_PATH}/${section.archiveName}`,
      );
    }

    setMeta?.(meta => ({
      ...meta,
      progress: 2 / 4,
      progressText: getString('backupScreen.uploadingData'),
    }));

    await sleep(200);

    await NativeZipArchive.zipDirectories(
      [
        { path: CACHE_DIR_PATH, prefix: '' },
        ...(options.downloadedFiles
          ? [{ path: NOVEL_STORAGE, prefix: BackupEntryName.NOVEL_FILES }]
          : []),
      ],
      CACHE_DIR_PATH + '.zip',
    );

    setMeta?.(meta => ({
      ...meta,
      progress: 3 / 4,
      progressText: getString('backupScreen.savingBackup'),
    }));

    await NativeFile.copyFile(CACHE_DIR_PATH + '.zip', destinationUri);

    const completionText = getBackupCompletionText(backupResult);
    setMeta?.(meta => ({
      ...meta,
      progress: 4 / 4,
      isRunning: false,
      progressText: completionText,
      completionText,
    }));
  } catch (error: any) {
    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
    }));
    throw error;
  }
};

export const restoreBackup = async (
  { sourceUri }: { sourceUri: string },
  setMeta?: TaskProgressUpdater,
) => {
  logRestoreBenchmark('local:start');
  let restoreResult: RestoreResult | undefined;
  try {
    setMeta?.(meta => ({
      ...meta,
      isRunning: true,
      progress: 0 / 4,
      progressText: getString('backupScreen.downloadingData'),
    }));

    await clearBackupCache();
    const localPath = CACHE_DIR_PATH + '-source.zip';
    await NativeFile.copyFile(sourceUri, localPath);
    logRestoreBenchmark('local:copy:done');

    setMeta?.(meta => ({
      ...meta,
      progress: 1 / 4,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    await NativeZipArchive.unzip(localPath, CACHE_DIR_PATH);
    logRestoreBenchmark('local:outer-unzip:done');

    setMeta?.(meta => ({
      ...meta,
      progress: 2 / 4,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    restoreResult = await restoreData(
      CACHE_DIR_PATH,
      setMeta,
      logRestoreBenchmark,
    );
    logRestoreBenchmark('local:restore-data:done');
    if (restoreResult.manifest.formatVersion === 1) {
      const legacyArchive = CACHE_DIR_PATH + '/' + ZipBackupName.DOWNLOAD;
      if (!(await NativeFile.exists(legacyArchive))) {
        throw new Error(getString('backupScreen.invalidBackupFolder'));
      }
      const legacyFilesRestorePath = getLegacyFilesRestorePath(CACHE_DIR_PATH);
      await NativeZipArchive.unzip(legacyArchive, legacyFilesRestorePath);
      await restoreLegacyFiles(
        legacyFilesRestorePath,
        restoreResult.novelMappings,
        restoreResult.restoreRunId,
      );
      logRestoreBenchmark('local:downloaded-files:done');
    } else {
      const novelFilesRestorePath = getNovelFilesRestorePath(CACHE_DIR_PATH);
      const sections = getSelectedBackupFileSections(
        restoreResult.manifest.sections,
        restoreResult.manifest.formatVersion,
      );
      if (
        restoreResult.manifest.formatVersion === 3 &&
        restoreResult.manifest.sections.downloadedFiles &&
        !(await NativeFile.exists(
          `${CACHE_DIR_PATH}/${BackupEntryName.NOVEL_FILES}`,
        ))
      ) {
        throw new Error(getString('backupScreen.invalidBackupFolder'));
      }
      for (const section of sections) {
        const archivePath = `${CACHE_DIR_PATH}/${section.archiveName}`;
        if (!(await NativeFile.exists(archivePath))) {
          throw new Error(getString('backupScreen.invalidBackupFolder'));
        }
        await NativeZipArchive.unzip(
          archivePath,
          section.archiveName === ZipBackupName.NOVEL_FILES
            ? novelFilesRestorePath
            : section.storagePath,
        );
      }
      logRestoreBenchmark('local:selected-archives:done');
      if (restoreResult.manifest.sections.downloadedFiles) {
        await restoreNovelFiles(
          restoreResult.manifest.formatVersion === 3
            ? `${CACHE_DIR_PATH}/${BackupEntryName.NOVEL_FILES}`
            : novelFilesRestorePath,
          restoreResult.novelMappings,
          restoreResult.restoreRunId,
        );
      }
    }
    logRestoreBenchmark('local:downloaded-files:done');
    logRestoreBenchmark('local:selected-files:done');
    const missingPluginIds = await finalizeRestoredPlugins(restoreResult);
    const completionText = getRestoreCompletionText(
      restoreResult,
      missingPluginIds,
    );
    logRestoreBenchmark('local:finalize:done');

    setMeta?.(meta => ({
      ...meta,
      progress: 4 / 4,
      isRunning: false,
      progressText: completionText,
      completionText,
    }));
  } catch (error: any) {
    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
    }));
    throw error;
  } finally {
    if (restoreResult) {
      await clearRestoreChapterMappingsSafely(restoreResult.restoreRunId);
    }
  }
};
