import type { NativeBackgroundTaskRecord } from '@specs/NativeBackgroundTasks';
import { getString } from '@strings/translations';
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
  'MIGRATE_NOVEL',
];

export const allowsDuplicateTask = (task: BackgroundTask) =>
  MULTIPLICABLE_TASKS.includes(task.name);

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
    case 'MIGRATE_NOVEL':
      return `${getString('notifications.MIGRATE_NOVEL')}: ${
        task.data.fromNovel.name
      }`;
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
