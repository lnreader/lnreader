import { sleep } from '@utils/sleep';
import { download, upload } from '@api/remote';
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
import { ZipBackupName } from '../types';
import { ROOT_STORAGE } from '@utils/Storages';
import type {
  SelfHostData,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { getSelectedBackupFileSections } from '../fileSections';
import { resolveBackupOptions } from '../options';

export const createSelfHostBackup = async (
  { host, backupFolder, options: requestedOptions }: SelfHostData,
  setMeta: TaskProgressUpdater,
) => {
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

  await sleep(200);

  await upload(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.uploadingSelectedFiles'),
  }));

  await sleep(200);

  for (const section of getSelectedBackupFileSections(options)) {
    await upload(host, backupFolder, section.archiveName, section.storagePath);
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

export const selfHostRestore = async (
  { host, backupFolder }: SelfHostData,
  setMeta: TaskProgressUpdater,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0 / 3,
    progressText: getString('backupScreen.downloadingData'),
  }));

  await clearBackupCache();
  await download(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 1 / 3,
    progressText: getString('backupScreen.restoringData'),
  }));

  await sleep(200);

  const restoreResult = await restoreData(CACHE_DIR_PATH, setMeta);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.restoringSelectedFiles'),
  }));

  await sleep(200);

  if (restoreResult.manifest.formatVersion === 1) {
    await download(host, backupFolder, ZipBackupName.DOWNLOAD, ROOT_STORAGE);
  } else {
    for (const section of getSelectedBackupFileSections(
      restoreResult.manifest.sections,
    )) {
      await download(
        host,
        backupFolder,
        section.archiveName,
        section.storagePath,
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
