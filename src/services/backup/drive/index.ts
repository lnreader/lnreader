import { DriveFile } from '@api/drive/types';
import { sleep } from '@utils/sleep';
import { getString } from '@i18n/translations';
import { CACHE_DIR_PATH } from '../cache';
import { prepareBackupData } from '../create';
import { getBackupCompletionText } from '../backupResult';
import { updateMetadata, uploadMedia } from '@api/drive/request';
import { ZipBackupName } from '../types';
import type {
  DriveBackupData,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { getSelectedBackupFileSections } from '../fileSections';
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

  for (const section of getSelectedBackupFileSections(options, 2)) {
    await uploadBackupSection(
      section.storagePath,
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
