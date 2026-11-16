import { DriveFile } from '@api/drive/types';
import { sleep } from '@utils/sleep';
import { exists } from '@api/drive';
import { getString } from '@i18n/translations';
import {
  CACHE_DIR_PATH,
  clearBackupCache,
  prepareBackupData,
  restoreData,
} from '../utils';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
} from '../restoreResult';
import { getBackupCompletionText } from '../backupResult';
import { download, updateMetadata, uploadMedia } from '@api/drive/request';
import { ZipBackupName } from '../types';
import type {
  DriveBackupData,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import {
  getBackupSectionSource,
  getLegacyFilesRestorePath,
  getNovelFilesRestorePath,
  removeEmptySectionMarker,
  getSelectedBackupFileSections,
  restoreLegacyFiles,
  restoreNovelFiles,
} from '../fileSections';
import { resolveBackupOptions } from '../options';

const uploadBackupSection = async (
  sourcePath: string,
  name: ZipBackupName,
  backupFolder: DriveFile,
) => {
  const file = await uploadMedia(sourcePath);
  await updateMetadata(
    file.id,
    {
      name,
      mimeType: 'application/zip',
      parents: [backupFolder.id],
    },
    file.parents[0],
  );
};

export const createDriveBackup = async (
  data: DriveBackupData,
  setMeta: TaskProgressUpdater,
) => {
  const backupFolder = 'backupFolder' in data ? data.backupFolder : data;
  const requestedOptions = 'backupFolder' in data ? data.options : undefined;
  const options = resolveBackupOptions(requestedOptions);
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0 / 3,
    progressText: getString('backupScreen.preparingData'),
  }));

  const backupResult = await prepareBackupData(CACHE_DIR_PATH, options);

  setMeta(meta => ({
    ...meta,
    progress: 1 / 3,
    progressText: getString('backupScreen.uploadingData'),
  }));

  await sleep(500);

  await uploadBackupSection(CACHE_DIR_PATH, ZipBackupName.DATA, backupFolder);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.uploadingSelectedFiles'),
  }));

  for (const section of getSelectedBackupFileSections(options)) {
    await uploadBackupSection(
      await getBackupSectionSource(section),
      section.archiveName,
      backupFolder,
    );
  }

  const completionText = getBackupCompletionText(backupResult);
  setMeta(meta => ({
    ...meta,
    progress: 3 / 3,
    isRunning: false,
    progressText: completionText,
    completionText,
  }));
};

export const driveRestore = async (
  backupFolder: DriveFile,
  setMeta: TaskProgressUpdater,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0 / 3,
    progressText: getString('backupScreen.downloadingData'),
  }));

  const zipDataFile = await exists(ZipBackupName.DATA, false, backupFolder.id);
  if (!zipDataFile) {
    throw new Error(getString('backupScreen.invalidBackupFolder'));
  }

  await clearBackupCache();
  await download(zipDataFile, CACHE_DIR_PATH);
  await sleep(500);

  setMeta(meta => ({
    ...meta,
    progress: 1 / 3,
    progressText: getString('backupScreen.restoringData'),
  }));

  const restoreResult = await restoreData(CACHE_DIR_PATH, setMeta);
  await sleep(500);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.restoringSelectedFiles'),
  }));

  if (restoreResult.manifest.formatVersion === 1) {
    const legacyFile = await exists(
      ZipBackupName.DOWNLOAD,
      false,
      backupFolder.id,
    );
    if (!legacyFile) {
      throw new Error(getString('backupScreen.invalidBackupFolder'));
    }
    const legacyFilesRestorePath = getLegacyFilesRestorePath(CACHE_DIR_PATH);
    await download(legacyFile, legacyFilesRestorePath);
    await restoreLegacyFiles(
      legacyFilesRestorePath,
      restoreResult.novelMappings,
    );
  } else {
    const novelFilesRestorePath = getNovelFilesRestorePath(CACHE_DIR_PATH);
    for (const section of getSelectedBackupFileSections(
      restoreResult.manifest.sections,
    )) {
      const file = await exists(section.archiveName, false, backupFolder.id);
      if (!file) {
        throw new Error(getString('backupScreen.invalidBackupFolder'));
      }
      const destination =
        section.archiveName === ZipBackupName.NOVEL_FILES
          ? novelFilesRestorePath
          : section.storagePath;
      await download(file, destination);
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

  setMeta(meta => ({
    ...meta,
    progress: 3 / 3,
    isRunning: false,
    progressText: completionText,
    completionText,
  }));
};
