import { DeviceEventEmitter } from 'react-native';

import NativeBackgroundTasks from '@modules/native-background-tasks';
import { getString } from '@i18n/translations';
import { askForPostNotificationsPermission } from '@utils/askForPostNoftificationsPermission';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { showToast } from '@utils/showToast';
import type {
  BackgroundTask,
  BackgroundTaskMetadata,
  DownloadChapterTask,
  QueuedBackgroundTask,
} from './contracts';
import { executeBackgroundTask } from './executeTask';
import {
  ACTIVE_BACKGROUND_TASK_STATES,
  allowsDuplicateTask,
  createBackgroundTaskMetadata,
  fromNativeTaskRecord,
  getBackgroundTaskQueueName,
  willTaskWaitInQueue,
} from './taskDefinitions';
import { BACKGROUND_TASKS_STORE_KEY } from './constants';

const makeTemporaryId = () =>
  `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class BackgroundTaskQueue {
  private interruptedTasks = new Map<string, 'pause' | 'cancel'>();
  private notificationPermissionRequest?: Promise<boolean>;

  constructor() {
    DeviceEventEmitter.addListener(
      'LNReaderTaskInterrupted',
      ({ taskId, action }: { taskId: string; action: 'pause' | 'cancel' }) => {
        this.interruptedTasks.set(taskId, action);
      },
    );
  }

  get isRunning() {
    return this.getSnapshot().some(
      task => task.state === 'running' || task.state === 'queued',
    );
  }

  getSnapshot() {
    return (
      getMMKVObject<QueuedBackgroundTask[]>(BACKGROUND_TASKS_STORE_KEY) || []
    );
  }

  async refresh() {
    const records = await NativeBackgroundTasks.getTasks();
    const queue = records
      .filter(record => ACTIVE_BACKGROUND_TASK_STATES.has(record.state))
      .map(fromNativeTaskRecord);
    this.store(queue);
    return queue;
  }

  enqueue = (tasks: BackgroundTask | BackgroundTask[]) => {
    for (const task of Array.isArray(tasks) ? tasks : [tasks]) {
      this.enqueueOne(task, true).catch(() => undefined);
    }
  };

  private enqueueSilently = (tasks: BackgroundTask | BackgroundTask[]) => {
    for (const task of Array.isArray(tasks) ? tasks : [tasks]) {
      this.enqueueOne(task, false).catch(() => undefined);
    }
  };

  async pauseAll() {
    const tasks = this.getSnapshot().filter(
      task => task.state === 'running' || task.state === 'queued',
    );
    tasks.forEach(task => this.interruptedTasks.set(task.id, 'pause'));
    await Promise.all(tasks.map(task => NativeBackgroundTasks.pause(task.id)));
    await this.refresh();
  }

  async resumeAll() {
    const tasks = this.getSnapshot().filter(task => task.state === 'paused');
    const results = await Promise.allSettled(
      tasks.map(task => NativeBackgroundTasks.resume(task.id)),
    );
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.interruptedTasks.delete(tasks[index].id);
      }
    });
    await this.refresh();
  }

  async cancelByType(name: BackgroundTask['name']) {
    const tasks = this.getSnapshot().filter(task => task.task.name === name);
    tasks.forEach(task => this.interruptedTasks.set(task.id, 'cancel'));
    await Promise.all(tasks.map(task => NativeBackgroundTasks.cancel(task.id)));
    await this.refresh();
  }

  /**
   * Cancel queued DOWNLOAD_CHAPTER tasks belonging to the given novels only
   * (#1874 rulings round 1): scoping by task name alone would over-cancel
   * the whole queue. Tasks persisted before per-novel queue identity carry
   * no novelId and are deliberately left running — silently killing
   * unattributable work would be worse than letting it finish. Returns the
   * NUMBER of such legacy tasks encountered while cancelling (round-2
   * review fix: selected-novels-without-tasks are NOT unattributable —
   * they simply have nothing queued), so the caller can surface a toast
   * only when legacy tasks actually exist.
   */
  async cancelForNovels(novelIds: number[]): Promise<number> {
    const wanted = new Set(novelIds);
    const snapshot = this.getSnapshot();
    const matched = snapshot.filter(
      task =>
        task.task.name === 'DOWNLOAD_CHAPTER' &&
        (task.task as DownloadChapterTask).data.novelId !== undefined &&
        wanted.has((task.task as DownloadChapterTask).data.novelId as number),
    );
    const legacyTaskCount = snapshot.filter(
      task =>
        task.task.name === 'DOWNLOAD_CHAPTER' &&
        (task.task as DownloadChapterTask).data.novelId === undefined,
    ).length;

    matched.forEach(task => this.interruptedTasks.set(task.id, 'cancel'));
    await Promise.all(
      matched.map(task => NativeBackgroundTasks.cancel(task.id)),
    );
    await this.refresh();

    return legacyTaskCount;
  }

  async cancelAll() {
    const tasks = this.getSnapshot();
    tasks.forEach(task => this.interruptedTasks.set(task.id, 'cancel'));
    await Promise.all(tasks.map(task => NativeBackgroundTasks.cancel(task.id)));
    this.store([]);
  }

  async run(taskId: string, task: BackgroundTask, checkpoint?: string) {
    const queue = this.getSnapshot();
    if (!queue.some(item => item.id === taskId)) {
      queue.push({
        id: taskId,
        task,
        state: 'running',
        meta: createBackgroundTaskMetadata(task, true),
      });
      this.store(queue);
    }

    try {
      await executeBackgroundTask(
        task,
        transformer => this.updateProgress(taskId, transformer),
        this.enqueueSilently,
        {
          checkpoint,
          updateCheckpoint: value => {
            if (this.interruptedTasks.get(taskId) === 'cancel') {
              this.throwIfInterrupted(taskId);
            }
            return NativeBackgroundTasks.updateCheckpoint(taskId, value);
          },
        },
      );
      this.throwIfInterrupted(taskId);
      const completedTask = this.getSnapshot().find(item => item.id === taskId);
      await NativeBackgroundTasks.complete(
        taskId,
        completedTask?.meta.completionText ??
          getString('notifications.taskCompleted'),
      );
    } catch (error) {
      await NativeBackgroundTasks.fail(
        taskId,
        getString('notifications.taskFailed', {
          error: error instanceof Error ? error.message : String(error),
        }),
        false,
      );
      if (!this.interruptedTasks.has(taskId)) {
        throw error;
      }
    } finally {
      this.finishLocalExecution(taskId);
    }
  }

  private async enqueueOne(task: BackgroundTask, showQueuedToast: boolean) {
    this.notificationPermissionRequest ??= askForPostNotificationsPermission();
    await this.notificationPermissionRequest;

    const current = this.getSnapshot();
    if (
      !allowsDuplicateTask(task) &&
      current.some(item => item.task.name === task.name)
    ) {
      return;
    }

    const pending: QueuedBackgroundTask = {
      id: makeTemporaryId(),
      task,
      state: 'queued',
      meta: createBackgroundTaskMetadata(task, false),
    };
    const shouldShowQueuedToast =
      showQueuedToast && willTaskWaitInQueue(task, current);
    this.store([...current, pending]);

    try {
      const id = await NativeBackgroundTasks.enqueue(
        task.name,
        JSON.stringify(task),
        pending.meta.name,
        pending.meta.progressText || getString('common.preparing'),
        allowsDuplicateTask(task),
        getBackgroundTaskQueueName(task),
      );
      const latest = this.getSnapshot().filter(item => item.id !== pending.id);
      if (!latest.some(item => item.id === id)) {
        latest.push({ ...pending, id });
      }
      this.store(latest);
      if (shouldShowQueuedToast) {
        showToast(
          getString('notifications.taskQueued', { task: pending.meta.name }),
        );
      }
    } catch (error) {
      this.store(this.getSnapshot().filter(item => item.id !== pending.id));
      showToast(
        `${pending.meta.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private updateProgress(
    taskId: string,
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) {
    this.throwIfInterrupted(taskId);

    const queue = this.getSnapshot();
    const index = queue.findIndex(task => task.id === taskId);
    if (index < 0) return;
    const meta = transformer(queue[index].meta);
    queue[index] = { ...queue[index], meta, state: 'running' };
    this.store(queue);
    NativeBackgroundTasks.updateProgress(
      taskId,
      meta.progress ?? -1,
      meta.progressText ?? '',
    ).catch(() => undefined);
  }

  private throwIfInterrupted(taskId: string) {
    const interruption = this.interruptedTasks.get(taskId);
    if (interruption) throw new Error(`Background task ${interruption}`);
  }

  private finishLocalExecution(taskId: string) {
    const interruption = this.interruptedTasks.get(taskId);
    if (interruption === 'pause') {
      this.store(
        this.getSnapshot().map(item =>
          item.id === taskId
            ? {
                ...item,
                state: 'paused',
                meta: { ...item.meta, isRunning: false },
              }
            : item,
        ),
      );
    } else {
      this.store(this.getSnapshot().filter(item => item.id !== taskId));
    }
    this.interruptedTasks.delete(taskId);
  }

  private store(tasks: QueuedBackgroundTask[]) {
    setMMKVObject(BACKGROUND_TASKS_STORE_KEY, tasks);
  }
}
