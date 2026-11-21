import { createDriveBackup, driveRestore } from '../backup/drive';
import { createBackup, restoreBackup } from '../backup/local';
import { createSelfHostBackup, selfHostRestore } from '../backup/selfhost';
import { downloadChapters } from '../download/downloadChapter';
import { exportEpub } from '../epub/export';
import { importEpubBatch } from '../epub/import';
import { migrateNovel } from '../migrate/migrateNovel';
import { updateLibrary } from '../updates';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { APP_SETTINGS, type AppSettings } from '@hooks/persisted/useSettings';
import type {
  BackgroundTask,
  BackgroundTaskEnqueuer,
  BackgroundTaskExecutionContext,
  TaskProgressUpdater,
} from './contracts';

export const executeBackgroundTask = async (
  task: BackgroundTask,
  updateProgress: TaskProgressUpdater,
  enqueue: BackgroundTaskEnqueuer,
  context: BackgroundTaskExecutionContext,
) => {
  switch (task.name) {
    case 'IMPORT_EPUB':
      return importEpubBatch(task.data, updateProgress);
    case 'EXPORT_EPUB':
      return exportEpub(task.data, updateProgress);
    case 'UPDATE_LIBRARY':
      return updateLibrary(task.data || {}, updateProgress, enqueue);
    case 'DRIVE_BACKUP':
      return createDriveBackup(task.data, updateProgress);
    case 'DRIVE_RESTORE':
      return driveRestore(task.data, updateProgress);
    case 'SELF_HOST_BACKUP':
      return createSelfHostBackup(task.data, updateProgress);
    case 'SELF_HOST_RESTORE':
      return selfHostRestore(task.data, updateProgress);
    case 'LOCAL_BACKUP': {
      if (!task.data.automatic) {
        return createBackup(task.data, updateProgress);
      }

      const options =
        getMMKVObject<AppSettings>(APP_SETTINGS)?.automaticBackupOptions;
      await createBackup({ ...task.data, options }, updateProgress);
      setMMKVObject(APP_SETTINGS, {
        ...getMMKVObject<AppSettings>(APP_SETTINGS),
        lastAutomaticBackupAt: Date.now(),
      });
      return;
    }
    case 'LOCAL_RESTORE':
      return restoreBackup(task.data, updateProgress);
    case 'MIGRATE_NOVEL':
      return migrateNovel(task.data, updateProgress, enqueue);
    case 'DOWNLOAD_CHAPTER':
      return downloadChapters(task.data, updateProgress, context);
  }
};
