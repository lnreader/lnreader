import { createDriveBackup, driveRestore } from '../backup/drive';
import { createBackup, restoreBackup } from '../backup/local';
import { createSelfHostBackup, selfHostRestore } from '../backup/selfhost';
import { downloadChapters } from '../download/downloadChapter';
import { exportNovel, importNovel, type EpubError } from '../epub/port';
import { migrateNovel } from '../migrate/migrateNovel';
import { updateLibrary } from '../updates';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
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
      return importEpubBatchThroughPort(task.data, updateProgress);
    case 'EXPORT_EPUB':
      return exportEpubThroughPort(task.data, updateProgress);
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
      await createBackup(task.data, updateProgress);
      if (task.data.automatic) {
        const settings =
          getMMKVObject<Record<string, unknown>>('APP_SETTINGS') ?? {};
        setMMKVObject('APP_SETTINGS', {
          ...settings,
          lastAutomaticBackupAt: Date.now(),
        });
      }
      return;
    case 'LOCAL_RESTORE':
      return restoreBackup(task.data, updateProgress);
    case 'MIGRATE_NOVEL':
      return migrateNovel(task.data, updateProgress, enqueue);
    case 'DOWNLOAD_CHAPTER':
      return downloadChapters(task.data, updateProgress, context);
  }
};

/**
 * Task-layer adapters over the EPUB port. Batching stays here (orchestration,
 * ruling f30793b); the port owns single-file domain logic. Errors surface as
 * data and are mapped to the task layer's string contract in one place.
 */
const formatEpubErrors = (filename: string, errors: EpubError[]): string =>
  errors
    .map(error => {
      switch (error.kind) {
        case 'file-not-found':
          return `${filename}: source file not found (${error.path})`;
        case 'zip-corrupt':
          return `${filename}: archive is corrupt (${error.path})`;
        case 'parse-failure':
          return `${filename}: ${error.message ?? 'could not parse'}`;
        case 'image-move-partial':
          return `${filename}: ${
            error.failed.length
          } file(s) failed to move (${error.failed.join(', ')})`;
        case 'db-write-failure':
          return `${filename}: database write failed at ${error.stage} stage`;
      }
    })
    .join('; ');

const importEpubBatchThroughPort = async (
  { files }: { files: { filename: string; uri: string }[] },
  setMeta: TaskProgressUpdater,
): Promise<void> => {
  if (!files.length) return;

  const failures: string[] = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const updateFileProgress: TaskProgressUpdater = transformer => {
      void transformer({
        name: file.filename,
        isRunning: true,
        progress: index / files.length,
        progressText: `${index + 1}/${files.length} · ${file.filename}`,
      });
      setMeta(meta => ({
        ...meta,
        isRunning: true,
        progress: index / files.length,
        progressText: `${index + 1}/${files.length} · ${file.filename}`,
      }));
    };

    const result = await importNovel(file, progress => {
      if (progress.phase !== 'db' || progress.total === 0) return;
      updateFileProgress(meta => ({
        ...meta,
        progressText: `${index + 1}/${files.length} · ${file.filename}`,
        progress:
          (index + progress.current / Math.max(1, progress.total)) /
          files.length,
      }));
    });

    if (!result.ok) {
      failures.push(formatEpubErrors(file.filename, result.errors));
    }
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));

  if (failures.length) {
    throw new Error(
      `${failures.length} of ${
        files.length
      } EPUB imports failed: ${failures.join('; ')}`,
    );
  }
};

const exportEpubThroughPort = async (
  data: { novelId: number; destinationUri: string; fileName: string },
  setMeta: TaskProgressUpdater,
): Promise<void> => {
  const result = await exportNovel(
    data.novelId,
    {
      destinationUri: data.destinationUri,
      filenameOverride: data.fileName,
      applyReaderTheme: false,
      includeCustomJs: false,
    },
    progress => {
      // Map the port's typed phases onto the task layer's coarse progress.
      const phaseShare =
        progress.phase === 'db'
          ? 0.05
          : progress.phase === 'parse'
          ? 0.1 + 0.85 * (progress.current / Math.max(1, progress.total))
          : 0.95;
      setMeta(meta => ({
        ...meta,
        isRunning: true,
        progress: phaseShare,
      }));
    },
  );

  if (!result.ok) {
    throw new Error(formatEpubErrors(data.fileName, result.errors));
  }

  setMeta(meta => ({
    ...meta,
    isRunning: false,
    progress: 1,
  }));
};
