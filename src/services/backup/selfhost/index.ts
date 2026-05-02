import { sleep } from '@utils/sleep';
import { download, upload } from '@api/remote';
import { getString } from '@strings/translations';
import { CACHE_DIR_PATH, prepareBackupData, restoreData } from '../utils';
import { ZipBackupName } from '../types';
import { ROOT_STORAGE } from '@utils/Storages';
import { BackgroundTaskMetadata } from '@services/ServiceManager';
import { RestoreMode } from '@database/queries/_restoreMergeUtils';

export interface SelfHostData {
  host: string;
  backupFolder: string;
}

export const createSelfHostBackup = async (
  { host, backupFolder }: SelfHostData,
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

  await sleep(200);

  await upload(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.uploadingDownloadedFiles'),
  }));

  await sleep(200);

  await upload(host, backupFolder, ZipBackupName.DOWNLOAD, ROOT_STORAGE);

  setMeta(meta => ({
    ...meta,
    progress: 3 / 3,
    isRunning: false,
  }));
};

export const selfHostRestore = async (
  { host, backupFolder }: SelfHostData,
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

  await download(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);

  setMeta(meta => ({
    ...meta,
    progress: 1 / 3,
    progressText: getString('backupScreen.restoringData'),
  }));

  await sleep(200);

  await restoreData(CACHE_DIR_PATH, mode);

  setMeta(meta => ({
    ...meta,
    progress: 2 / 3,
    progressText: getString('backupScreen.downloadingDownloadedFiles'),
  }));

  await sleep(200);

  await download(host, backupFolder, ZipBackupName.DOWNLOAD, ROOT_STORAGE);

  setMeta(meta => ({
    ...meta,
    progress: 3 / 3,
    isRunning: false,
  }));
};
