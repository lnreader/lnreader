import { sleep } from '@utils/sleep';
import { upload } from '@api/remote';
import { getString } from '@i18n/translations';
import { CACHE_DIR_PATH } from '../cache';
import { prepareBackupData } from '../create';
import { getBackupCompletionText } from '../backupResult';
import { ZipBackupName } from '../types';
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

  for (const section of getSelectedBackupFileSections(options, 2)) {
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
