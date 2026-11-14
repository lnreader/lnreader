import { download } from '@api/remote';
import { getString } from '@i18n/translations';
import { CACHE_DIR_PATH, clearBackupCache } from '../cache';
import { ZipBackupName } from '../types';
import type {
  SelfHostData,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { runRestore } from './run';

export const selfHostRestore = async (
  { host, backupFolder }: SelfHostData,
  setMeta: TaskProgressUpdater,
) => {
  await runRestore(
    {
      kind: 'remote',
      prepare: async report => {
        const progressText = getString('backupScreen.downloadingData');
        report?.('source', 0, progressText, true);
        await clearBackupCache();
        await download(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);
        report?.('source', 1, progressText, true);
        report?.('extract', 1, progressText, true);
      },
      loadArchive: async (name, destination) => {
        await download(host, backupFolder, name, destination);
      },
    },
    setMeta,
  );
};
