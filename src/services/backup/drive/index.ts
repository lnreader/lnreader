import { DriveFile } from '@api/drive/types';
import { sleep } from '@utils/sleep';
import { exists } from '@api/drive';
import { getString } from '@strings/translations';
import { CACHE_DIR_PATH, prepareBackupData, restoreData } from '../utils';
import { download, updateMetadata, uploadMedia } from '@api/drive/request';
import { ZipBackupName } from '../types';
import { ROOT_STORAGE } from '@utils/Storages';
import { BackgroundTaskMetadata } from '@services/ServiceManager';
import { RestoreMode } from '@database/queries/_restoreMergeUtils';

export const createDriveBackup = async (
  backupFolder: DriveFile,
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0 / 3,
    progressText: getString('backupScreen.preparingData'),
  }));

  await prepareBackupData(CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 1 / 3,
    progressText: getString('backupScreen.uploadingData'),
  }));

  await sleep(500);

  const file = await uploadMedia(CACHE_DIR_PATH);

  await updateMetadata(
    file.id,
    {
      name: ZipBackupName.DATA,
      mimeType: 'application/zip',
      parents: [backupFolder.id],
    },
    file.parents[0],
  );

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.uploadingDownloadedFiles'),
  }));

  const file2 = await uploadMedia(ROOT_STORAGE);
  await updateMetadata(
    file2.id,
    {
      name: ZipBackupName.DOWNLOAD,
      mimeType: 'application/zip',
      parents: [backupFolder.id],
    },
    file2.parents[0],
  );

  setMeta(meta => ({
    ...meta,
    progress: 3 / 3,
    isRunning: false,
  }));
};

export const driveRestore = async (
  backupFolder: DriveFile,
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
  mode: RestoreMode = 'overwrite',
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0 / 3,
    progressText: getString('backupScreen.downloadingData'),
  }));

  const zipDataFile = await exists(ZipBackupName.DATA, false, backupFolder.id);
  const zipDownloadFile = await exists(
    ZipBackupName.DOWNLOAD,
    false,
    backupFolder.id,
  );
  if (!zipDataFile || !zipDownloadFile) {
    throw new Error(getString('backupScreen.invalidBackupFolder'));
  }

  await download(zipDataFile, CACHE_DIR_PATH);
  await sleep(500);

  setMeta(meta => ({
    ...meta,
    progress: 1 / 3,
    progressText: getString('backupScreen.restoringData'),
  }));

  await restoreData(CACHE_DIR_PATH, mode);
  await sleep(500);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.downloadingDownloadedFiles'),
  }));

  await download(zipDownloadFile, ROOT_STORAGE);

  setMeta(meta => ({
    ...meta,
    progress: 3 / 3,
    isRunning: false,
  }));
};
