import {
  assertSupportedBackupArchive,
  CACHE_DIR_PATH,
  clearRestoreWorkingFiles,
  clearRestoreWorkingFilesAfterRestore,
  isPickedBackupPath,
  prepareBackupData,
  RESTORE_SOURCE_COPY_PATH,
  restoreData,
} from '../utils';
import { createArchiveBackupSource, type BackupSource } from '../backupSource';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
} from '../restoreResult';
import { getBackupCompletionText } from '../backupResult';
import NativeZipArchive from '@modules/native-zip-archive';
import { ZipBackupName } from '../types';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import { sleep } from '@utils/sleep';
import {
  extractSectionArchive,
  getBackupSectionSource,
  getLegacyFilesRestorePath,
  getNovelFilesRestorePath,
  removeEmptySectionMarker,
  getSelectedBackupFileSections,
  restoreLegacyFiles,
  restoreNovelFiles,
} from '../fileSections';
import { resolveBackupOptions, type BackupOptions } from '../options';

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

    const backupResult = await prepareBackupData(CACHE_DIR_PATH, options);

    setMeta?.(meta => ({
      ...meta,
      progress: 1 / 4,
      progressText: getString('backupScreen.preparingSelectedFiles'),
    }));

    await sleep(200);

    for (const section of getSelectedBackupFileSections(options)) {
      await NativeZipArchive.zip(
        await getBackupSectionSource(section),
        `${CACHE_DIR_PATH}/${section.archiveName}`,
      );
    }

    setMeta?.(meta => ({
      ...meta,
      progress: 2 / 4,
      progressText: getString('backupScreen.uploadingData'),
    }));

    await sleep(200);

    await NativeZipArchive.zip(CACHE_DIR_PATH, CACHE_DIR_PATH + '.zip');

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

// Reads the picked backup in place. A provider that can only stream it is
// read from a local copy instead, as every restore did before.
const openBackupArchive = async (sourceUri: string) => {
  try {
    return await NativeZipArchive.openArchive(sourceUri);
  } catch (error) {
    if (
      (error as { code?: string })?.code !== 'NOT_SEEKABLE' ||
      isPickedBackupPath(sourceUri, RESTORE_SOURCE_COPY_PATH)
    ) {
      throw error;
    }
    await NativeFile.copyFile(sourceUri, RESTORE_SOURCE_COPY_PATH);
    return NativeZipArchive.openArchive(RESTORE_SOURCE_COPY_PATH);
  }
};

// File sections are archives nested in the backup. Each is taken out on its
// own and deleted once used, before the next one.
const withNestedArchive = async (
  source: BackupSource,
  archiveName: string,
  extract: (archivePath: string) => Promise<unknown>,
) => {
  const archivePath = `${CACHE_DIR_PATH}/${archiveName}`;
  await NativeFile.mkdir(CACHE_DIR_PATH);
  await source.takeFile(archiveName, archivePath);
  try {
    await extract(archivePath);
  } finally {
    await NativeFile.unlink(archivePath);
  }
};

export const restoreBackup = async (
  { sourceUri }: { sourceUri: string },
  setMeta?: TaskProgressUpdater,
) => {
  try {
    setMeta?.(meta => ({
      ...meta,
      isRunning: true,
      progress: 0 / 4,
      progressText: getString('backupScreen.downloadingData'),
    }));

    // Rejects a backup in an unsupported format before anything is written.
    await assertSupportedBackupArchive(sourceUri);

    await clearRestoreWorkingFiles(sourceUri);
    const archive = await openBackupArchive(sourceUri);
    try {
      const source = createArchiveBackupSource(archive);

      setMeta?.(meta => ({
        ...meta,
        progress: 1 / 4,
        progressText: getString('backupScreen.restoringData'),
      }));

      await sleep(200);

      const restoreResult = await restoreData(source, setMeta);

      setMeta?.(meta => ({
        ...meta,
        progress: 3 / 4,
        progressText: getString('backupScreen.restoringSelectedFiles'),
      }));

      await sleep(200);

      if (restoreResult.manifest.formatVersion === 1) {
        if (!(await source.exists(ZipBackupName.DOWNLOAD))) {
          throw new Error(getString('backupScreen.invalidBackupFolder'));
        }
        const legacyFilesRestorePath =
          getLegacyFilesRestorePath(CACHE_DIR_PATH);
        await withNestedArchive(source, ZipBackupName.DOWNLOAD, archivePath =>
          NativeZipArchive.unzip(archivePath, legacyFilesRestorePath),
        );
        await restoreLegacyFiles(
          legacyFilesRestorePath,
          restoreResult.novelMappings,
        );
      } else {
        const novelFilesRestorePath = getNovelFilesRestorePath(CACHE_DIR_PATH);
        for (const section of getSelectedBackupFileSections(
          restoreResult.manifest.sections,
        )) {
          if (!(await source.exists(section.archiveName))) {
            throw new Error(getString('backupScreen.invalidBackupFolder'));
          }
          const destination =
            section.archiveName === ZipBackupName.NOVEL_FILES
              ? novelFilesRestorePath
              : section.storagePath;
          await withNestedArchive(source, section.archiveName, archivePath =>
            extractSectionArchive(() =>
              NativeZipArchive.unzip(archivePath, destination),
            ),
          );
          await removeEmptySectionMarker(destination);
        }
        if (restoreResult.manifest.sections.downloadedFiles) {
          await restoreNovelFiles(
            novelFilesRestorePath,
            restoreResult.novelMappings,
          );
        }
      }
      const missingPluginIds = await finalizeRestoredPlugins(restoreResult);
      const completionText = getRestoreCompletionText(
        restoreResult,
        missingPluginIds,
      );

      setMeta?.(meta => ({
        ...meta,
        progress: 4 / 4,
        isRunning: false,
        progressText: completionText,
        completionText,
      }));
    } finally {
      await NativeZipArchive.closeArchive(archive);
    }
  } catch (error: any) {
    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
    }));
    throw error;
  } finally {
    await clearRestoreWorkingFilesAfterRestore(sourceUri);
  }
};
