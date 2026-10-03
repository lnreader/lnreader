import { DriveFile } from '@api/drive/types';
import { exists } from '@api/drive';
import { download } from '@api/drive/request';
import { getString } from '@i18n/translations';
import { CACHE_DIR_PATH, clearBackupCache } from '../cache';
import { ZipBackupName } from '../types';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import { runRestore } from './run';

export const driveRestore = async (
  backupFolder: DriveFile,
  setMeta: TaskProgressUpdater,
) => {
  await runRestore(
    {
      kind: 'remote',
      prepare: async report => {
        const progressText = getString('backupScreen.downloadingData');
        report?.('source', 0, progressText, true);
        const dataFile = await exists(
          ZipBackupName.DATA,
          false,
          backupFolder.id,
        );
        if (!dataFile) {
          throw new Error(getString('backupScreen.invalidBackupFolder'));
        }
        await clearBackupCache();
        await download(dataFile, CACHE_DIR_PATH);
        report?.('source', 1, progressText, true);
        report?.('extract', 1, progressText, true);
      },
      loadArchive: async (name, destination) => {
        const archive = await exists(name, false, backupFolder.id);
        if (!archive) {
          throw new Error(getString('backupScreen.invalidBackupFolder'));
        }
        await download(archive, destination);
      },
    },
    setMeta,
  );
};
