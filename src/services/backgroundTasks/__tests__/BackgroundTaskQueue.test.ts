import NativeBackgroundTasks from '@modules/native-background-tasks';
import { showToast } from '@utils/showToast';
import { BackgroundTaskQueue } from '../BackgroundTaskQueue';
import { executeBackgroundTask } from '../executeTask';

let mockStoredTasks: unknown[] = [];

jest.mock('@modules/native-background-tasks', () => ({
  __esModule: true,
  default: {
    complete: jest.fn(),
    enqueue: jest.fn().mockResolvedValue('native-task-1'),
    fail: jest.fn(),
    updateProgress: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../executeTask', () => ({
  executeBackgroundTask: jest.fn(),
}));

jest.mock('@utils/askForPostNoftificationsPermission', () => ({
  askForPostNotificationsPermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(() => mockStoredTasks),
  setMMKVObject: jest.fn((_key: string, value: unknown[]) => {
    mockStoredTasks = value;
  }),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string, options?: Record<string, string>) =>
    key === 'notifications.taskFailed'
      ? `Failed: ${options?.error}`
      : key === 'notifications.taskQueued'
      ? `${options?.task} queued`
      : key === 'notifications.LOCAL_RESTORE'
      ? 'Local restore'
      : key === 'notifications.DOWNLOAD_CHAPTER'
      ? 'Download'
      : key === 'common.preparing'
      ? 'Preparing'
      : 'Completed',
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

const task = {
  name: 'LOCAL_RESTORE' as const,
  data: { sourceUri: 'file://backup.zip' },
};

describe('BackgroundTaskQueue completion notifications', () => {
  beforeEach(() => {
    mockStoredTasks = [];
    jest.clearAllMocks();
  });

  it('passes a task-provided completion summary to the native notification', async () => {
    jest
      .mocked(executeBackgroundTask)
      .mockImplementation(async (_task, updateProgress) => {
        updateProgress(meta => ({
          ...meta,
          completionText: 'Backup restored with warnings',
        }));
      });

    await new BackgroundTaskQueue().run('restore-1', task);

    expect(NativeBackgroundTasks.complete).toHaveBeenCalledWith(
      'restore-1',
      'Backup restored with warnings',
    );
  });

  it('localizes failure text before handing it to the native notification', async () => {
    jest
      .mocked(executeBackgroundTask)
      .mockRejectedValueOnce(new Error('Invalid backup'));

    await expect(
      new BackgroundTaskQueue().run('restore-2', task),
    ).rejects.toThrow('Invalid backup');
    expect(NativeBackgroundTasks.fail).toHaveBeenCalledWith(
      'restore-2',
      'Failed: Invalid backup',
      false,
    );
  });

  it('shows queued feedback when the task must wait in its lane', async () => {
    const downloadTask = {
      name: 'DOWNLOAD_CHAPTER' as const,
      data: {
        novelName: 'Example Novel',
        novelId: 42,
        pluginId: 'source-a',
        chapters: [{ chapterId: 7, chapterName: 'Chapter 7' }],
      },
    };
    mockStoredTasks = [
      {
        id: 'existing-task',
        task: downloadTask,
        state: 'running',
        meta: {
          name: 'Download: Example Novel',
          isRunning: true,
          progress: undefined,
          progressText: undefined,
        },
      },
    ];

    new BackgroundTaskQueue().enqueue(downloadTask);
    await Promise.resolve();
    await Promise.resolve();

    expect(NativeBackgroundTasks.enqueue).toHaveBeenCalledWith(
      downloadTask.name,
      JSON.stringify(downloadTask),
      'Download: Example Novel',
      'Chapter 7',
      true,
      'lnreader-background-task:download:source-a',
    );
    expect(showToast).toHaveBeenCalledWith('Download: Example Novel queued');
  });

  it('does not show queued feedback when the task can start immediately', async () => {
    new BackgroundTaskQueue().enqueue(task);
    await Promise.resolve();
    await Promise.resolve();

    expect(NativeBackgroundTasks.enqueue).toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('keeps progress updates scoped to concurrently running tasks', async () => {
    const firstTask = {
      name: 'LOCAL_RESTORE' as const,
      data: { sourceUri: 'file://first.zip' },
    };
    const secondTask = {
      name: 'LOCAL_RESTORE' as const,
      data: { sourceUri: 'file://second.zip' },
    };
    const resolvers: (() => void)[] = [];

    jest
      .mocked(executeBackgroundTask)
      .mockImplementation(async (runningTask, updateProgress) => {
        if (runningTask.name !== 'LOCAL_RESTORE') {
          throw new Error('Unexpected task type');
        }
        updateProgress(meta => ({
          ...meta,
          progressText: runningTask.data.sourceUri,
        }));
        await new Promise<void>(resolve => resolvers.push(resolve));
      });

    const firstRun = new BackgroundTaskQueue().run('first', firstTask);
    const secondRun = new BackgroundTaskQueue().run('second', secondTask);
    await Promise.resolve();

    expect(NativeBackgroundTasks.updateProgress).toHaveBeenCalledWith(
      'first',
      -1,
      'file://first.zip',
    );
    expect(NativeBackgroundTasks.updateProgress).toHaveBeenCalledWith(
      'second',
      -1,
      'file://second.zip',
    );

    resolvers.forEach(resolve => resolve());
    await Promise.all([firstRun, secondRun]);
  });
});
