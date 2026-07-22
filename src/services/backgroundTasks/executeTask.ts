import { createDriveBackup, driveRestore } from '../backup/drive';
import { createBackup, restoreBackup } from '../backup/local';
import { createSelfHostBackup, selfHostRestore } from '../backup/selfhost';
import { downloadChapter } from '../download/downloadChapter';
import { importEpub } from '../epub/import';
import { migrateNovel } from '../migrate/migrateNovel';
import { updateLibrary } from '../updates';
import type {
  BackgroundTask,
  BackgroundTaskEnqueuer,
  TaskProgressUpdater,
} from './contracts';

export const executeBackgroundTask = async (
  task: BackgroundTask,
  updateProgress: TaskProgressUpdater,
  enqueue: BackgroundTaskEnqueuer,
) => {
  switch (task.name) {
    case 'IMPORT_EPUB':
      return importEpub(task.data, updateProgress);
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
    case 'LOCAL_BACKUP':
      return createBackup(task.data, updateProgress);
    case 'LOCAL_RESTORE':
      return restoreBackup(task.data, updateProgress);
    case 'MIGRATE_NOVEL':
      return migrateNovel(task.data, updateProgress, enqueue);
    case 'DOWNLOAD_CHAPTER':
      return downloadChapter(task.data, updateProgress);
  }
};
