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
import NativeZipArchive from '@modules/native-zip-archive';
import { ROOT_STORAGE } from '@utils/Storages';
import { ZipBackupName } from '../types';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import { sleep } from '@utils/sleep';
import { getSelectedBackupFileSections } from '../fileSections';
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

    await clearBackupCache();
    const localPath = CACHE_DIR_PATH + '-source.zip';
    await NativeFile.copyFile(sourceUri, localPath);

    setMeta?.(meta => ({
      ...meta,
      progress: 1 / 4,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    await NativeZipArchive.unzip(localPath, CACHE_DIR_PATH);

    setMeta?.(meta => ({
      ...meta,
      progress: 2 / 4,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    const restoreResult = await restoreData(CACHE_DIR_PATH, setMeta);

    setMeta?.(meta => ({
      ...meta,
      progress: 3 / 4,
      progressText: getString('backupScreen.restoringSelectedFiles'),
    }));

    await sleep(200);

    if (restoreResult.manifest.formatVersion === 1) {
      const legacyArchive = CACHE_DIR_PATH + '/' + ZipBackupName.DOWNLOAD;
      if (!(await NativeFile.exists(legacyArchive))) {
        throw new Error(getString('backupScreen.invalidBackupFolder'));
      }
      await NativeZipArchive.unzip(legacyArchive, ROOT_STORAGE);
    } else {
      for (const section of getSelectedBackupFileSections(
        restoreResult.manifest.sections,
      )) {
        const archivePath = `${CACHE_DIR_PATH}/${section.archiveName}`;
        if (!(await NativeFile.exists(archivePath))) {
          throw new Error(getString('backupScreen.invalidBackupFolder'));
        }
        await NativeZipArchive.unzip(archivePath, section.storagePath);
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
  } catch (error: any) {
    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
    }));
    throw error;
  }
};
