import type { NativeBackgroundTaskRecord } from '@modules/native-background-tasks';
import { getString } from '@i18n/translations';
import type {
  BackgroundTask,
  BackgroundTaskMetadata,
  QueuedBackgroundTask,
} from './contracts';

export const ACTIVE_BACKGROUND_TASK_STATES = new Set([
  'queued',
  'running',
  'paused',
]);

const MULTIPLICABLE_TASKS: BackgroundTask['name'][] = [
  'DOWNLOAD_CHAPTER',
  'IMPORT_EPUB',
  'EXPORT_EPUB',
  'MIGRATE_NOVEL',
];

const BACKGROUND_TASK_QUEUE_PREFIX = 'lnreader-background-task';
const MAX_CONCURRENT_DOWNLOADS = 3;

export const allowsDuplicateTask = (task: BackgroundTask) =>
  MULTIPLICABLE_TASKS.includes(task.name);

export const getDownloadProgressKey = (
  tasks: (QueuedBackgroundTask | BackgroundTask)[] | undefined,
  novelId?: number,
) =>
  (tasks ?? [])
    .filter((task): task is QueuedBackgroundTask => 'task' in task)
    .filter(
      task =>
        task.task.name === 'DOWNLOAD_CHAPTER' &&
        (novelId === undefined || task.task.data.novelId === novelId),
    )
    .map(
      task =>
        `${task.id}:${task.state ?? 'queued'}:${
          task.meta.progress ?? 'pending'
        }`,
    )
    .join('|');

export const getBackgroundTaskQueueName = (task: BackgroundTask) =>
  task.name === 'DOWNLOAD_CHAPTER'
    ? `${BACKGROUND_TASK_QUEUE_PREFIX}:download:${
        task.data.pluginId || 'legacy'
      }`
    : `${BACKGROUND_TASK_QUEUE_PREFIX}:task:${task.name}`;

export const willTaskWaitInQueue = (
  task: BackgroundTask,
  activeTasks: QueuedBackgroundTask[],
) => {
  const queueName = getBackgroundTaskQueueName(task);
  if (
    activeTasks.some(
      activeTask => getBackgroundTaskQueueName(activeTask.task) === queueName,
    )
  ) {
    return true;
  }

  if (task.name !== 'DOWNLOAD_CHAPTER') {
    return false;
  }

  const activeDownloadLanes = new Set(
    activeTasks
      .filter(
        activeTask =>
          activeTask.task.name === 'DOWNLOAD_CHAPTER' &&
          activeTask.state !== 'paused',
      )
      .map(activeTask => getBackgroundTaskQueueName(activeTask.task)),
  );
  return activeDownloadLanes.size >= MAX_CONCURRENT_DOWNLOADS;
};

export const getBackgroundTaskTitle = (task: BackgroundTask) => {
  switch (task.name) {
    case 'DOWNLOAD_CHAPTER':
      return `${getString('notifications.DOWNLOAD_CHAPTER')}: ${
        task.data.novelName
      }`;
    case 'IMPORT_EPUB':
      return task.data.files.length === 1
        ? `${getString('notifications.IMPORT_EPUB')}: ${
            task.data.files[0].filename
          }`
        : `${getString('notifications.IMPORT_EPUB')} (${
            task.data.files.length
          })`;
    case 'EXPORT_EPUB':
      return `${getString('notifications.EXPORT_EPUB')}: ${
        task.data.novelName
      }`;
    case 'MIGRATE_NOVEL':
      return `${getString('notifications.MIGRATE_NOVEL')}: ${
        task.data.fromNovel.name
      }`;
    case 'MIGRATE_DOWNLOAD_STORAGE':
      return getString('notifications.MIGRATE_DOWNLOAD_STORAGE');
    case 'UPDATE_LIBRARY':
      return task.data?.categoryName
        ? `${getString('notifications.UPDATE_LIBRARY')}: ${
            task.data.categoryName
          }`
        : getString('notifications.UPDATE_LIBRARY');
    default:
      return getString(`notifications.${task.name}`);
  }
};

export const createBackgroundTaskMetadata = (
  task: BackgroundTask,
  isRunning: boolean,
): BackgroundTaskMetadata => ({
  name: getBackgroundTaskTitle(task),
  isRunning,
  progress: undefined,
  progressText:
    task.name === 'DOWNLOAD_CHAPTER'
      ? task.data.chapters[0]?.chapterName
      : task.name === 'IMPORT_EPUB'
      ? task.data.files[0]?.filename
      : task.name === 'EXPORT_EPUB'
      ? getString('novelScreen.epub.preparingExport')
      : task.name === 'MIGRATE_DOWNLOAD_STORAGE'
      ? getString('dataStorageScreen.storageMigrationPreparing')
      : undefined,
});

export const fromNativeTaskRecord = (
  record: NativeBackgroundTaskRecord,
): QueuedBackgroundTask => {
  const task = JSON.parse(record.payload) as BackgroundTask;
  return {
    id: record.id,
    task,
    state: record.state,
    meta: {
      name: record.title,
      isRunning: record.state === 'running',
      progress: record.progress,
      progressText: record.progressText,
    },
  };
};
