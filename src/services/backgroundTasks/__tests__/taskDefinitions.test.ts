import type { NativeBackgroundTaskRecord } from '@modules/native-background-tasks';
import type { BackgroundTask } from '../contracts';
import {
  allowsDuplicateTask,
  createBackgroundTaskMetadata,
  fromNativeTaskRecord,
  getBackgroundTaskQueueName,
  getBackgroundTaskTitle,
  getDownloadProgressKey,
  willTaskWaitInQueue,
} from '../taskDefinitions';

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

describe('background task definitions', () => {
  it.each<BackgroundTask['name']>([
    'DOWNLOAD_CHAPTER',
    'IMPORT_EPUB',
    'MIGRATE_NOVEL',
  ])('allows duplicate %s tasks', name => {
    expect(allowsDuplicateTask({ name } as BackgroundTask)).toBe(true);
  });

  it('prevents duplicate singleton task types', () => {
    expect(
      allowsDuplicateTask({ name: 'UPDATE_LIBRARY' } as BackgroundTask),
    ).toBe(false);
  });

  it('derives user-facing download metadata', () => {
    const task: BackgroundTask = {
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: 'Example Novel',
        novelId: 42,
        pluginId: 'source-a',
        chapters: [{ chapterId: 42, chapterName: 'Chapter 7' }],
      },
    };

    expect(getBackgroundTaskTitle(task)).toBe(
      'notifications.DOWNLOAD_CHAPTER: Example Novel',
    );
    expect(createBackgroundTaskMetadata(task, false)).toEqual({
      name: 'notifications.DOWNLOAD_CHAPTER: Example Novel',
      isRunning: false,
      progress: undefined,
      progressText: 'Chapter 7',
    });
  });

  it('serializes downloads from one plugin but separates other plugin lanes', () => {
    const createDownload = (pluginId: string): BackgroundTask => ({
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: 'Example Novel',
        novelId: 42,
        pluginId,
        chapters: [{ chapterId: 42, chapterName: 'Chapter 7' }],
      },
    });

    expect(getBackgroundTaskQueueName(createDownload('source-a'))).toBe(
      getBackgroundTaskQueueName(createDownload('source-a')),
    );
    expect(getBackgroundTaskQueueName(createDownload('source-a'))).not.toBe(
      getBackgroundTaskQueueName(createDownload('source-b')),
    );
  });

  it('uses independent lanes for different non-download task types', () => {
    expect(getBackgroundTaskQueueName({ name: 'UPDATE_LIBRARY' })).not.toBe(
      getBackgroundTaskQueueName({
        name: 'LOCAL_RESTORE',
        data: { sourceUri: 'file://backup.zip' },
      }),
    );
  });

  it('only reports queueing when a lane or the global limit blocks a task', () => {
    const createDownload = (pluginId: string): BackgroundTask => ({
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: pluginId,
        pluginId,
        chapters: [{ chapterId: 42, chapterName: 'Chapter 7' }],
      },
    });
    const queuedDownload = (pluginId: string) => ({
      id: pluginId,
      task: createDownload(pluginId),
      state: 'queued' as const,
      meta: createBackgroundTaskMetadata(createDownload(pluginId), false),
    });

    expect(willTaskWaitInQueue(createDownload('source-a'), [])).toBe(false);
    expect(
      willTaskWaitInQueue(createDownload('source-a'), [
        queuedDownload('source-a'),
      ]),
    ).toBe(true);
    expect(
      willTaskWaitInQueue(createDownload('source-d'), [
        queuedDownload('source-a'),
        queuedDownload('source-b'),
        queuedDownload('source-c'),
      ]),
    ).toBe(true);
  });

  it('derives metadata for a multi-file EPUB import', () => {
    const task: BackgroundTask = {
      name: 'IMPORT_EPUB',
      data: {
        files: [
          { filename: 'First.epub', uri: 'file://first' },
          { filename: 'Second.epub', uri: 'file://second' },
        ],
      },
    };

    expect(getBackgroundTaskTitle(task)).toBe('notifications.IMPORT_EPUB (2)');
    expect(createBackgroundTaskMetadata(task, false).progressText).toBe(
      'First.epub',
    );
  });

  it('derives notification metadata for storage migration', () => {
    const task: BackgroundTask = {
      name: 'MIGRATE_DOWNLOAD_STORAGE',
      data: { directoryName: 'LNReader', directoryUri: 'content://root' },
    };

    expect(getBackgroundTaskTitle(task)).toBe(
      'notifications.MIGRATE_DOWNLOAD_STORAGE',
    );
    expect(createBackgroundTaskMetadata(task, false).progressText).toBe(
      'dataStorageScreen.storageMigrationPreparing',
    );
  });

  it('maps a native record into the reactive queue projection', () => {
    const task: BackgroundTask = { name: 'UPDATE_LIBRARY' };
    const record: NativeBackgroundTaskRecord = {
      id: 'task-1',
      type: task.name,
      payload: JSON.stringify(task),
      title: 'Update library',
      state: 'running',
      progress: 0.5,
      progressText: 'Example Novel',
      attempt: 1,
      createdAt: 1,
      updatedAt: 2,
    };

    expect(fromNativeTaskRecord(record)).toEqual({
      id: 'task-1',
      task,
      state: 'running',
      meta: {
        name: 'Update library',
        isRunning: true,
        progress: 0.5,
        progressText: 'Example Novel',
      },
    });
  });

  it('derives progress keys only for the requested novel downloads', () => {
    const createDownload = (
      id: string,
      novelId: number,
      progress?: number,
    ) => ({
      id,
      task: {
        name: 'DOWNLOAD_CHAPTER' as const,
        data: {
          novelName: `Novel ${novelId}`,
          novelId,
          chapters: [{ chapterId: novelId, chapterName: 'Chapter 1' }],
        },
      },
      state: 'running' as const,
      meta: {
        name: `Novel ${novelId}`,
        isRunning: true,
        progress,
        progressText: 'Chapter 1',
      },
    });
    const tasks: (ReturnType<typeof createDownload> | BackgroundTask)[] = [
      { name: 'UPDATE_LIBRARY' },
      createDownload('first', 1, 0.5),
      createDownload('second', 2),
    ];

    expect(getDownloadProgressKey(tasks, 1)).toBe('first:running:0.5');
    expect(getDownloadProgressKey(tasks, 2)).toBe('second:running:pending');
  });
});
