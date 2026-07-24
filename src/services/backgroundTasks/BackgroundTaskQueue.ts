import { DeviceEventEmitter } from 'react-native';

import NativeBackgroundTasks from '@modules/native-background-tasks';
import { getString } from '@i18n/translations';
import { askForPostNotificationsPermission } from '@utils/askForPostNoftificationsPermission';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { showToast } from '@utils/showToast';
import type {
  BackgroundTask,
  BackgroundTaskMetadata,
  QueuedBackgroundTask,
} from './contracts';
import { executeBackgroundTask } from './executeTask';
import {
  ACTIVE_BACKGROUND_TASK_STATES,
  allowsDuplicateTask,
  createBackgroundTaskMetadata,
  fromNativeTaskRecord,
} from './taskDefinitions';

export const BACKGROUND_TASKS_STORE_KEY = 'APP_SERVICE';

const makeTemporaryId = () =>
  `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class BackgroundTaskQueue {
  private currentTaskId?: string;
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
      this.enqueueOne(task).catch(() => undefined);
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

  async cancelAll() {
    const tasks = this.getSnapshot();
    tasks.forEach(task => this.interruptedTasks.set(task.id, 'cancel'));
    await Promise.all(tasks.map(task => NativeBackgroundTasks.cancel(task.id)));
    this.store([]);
  }

  async run(taskId: string, task: BackgroundTask, checkpoint?: string) {
    this.currentTaskId = taskId;
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
        this.updateProgress.bind(this),
        this.enqueue,
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
      await NativeBackgroundTasks.complete(taskId);
    } catch (error) {
      await NativeBackgroundTasks.fail(taskId, String(error), false);
      if (!this.interruptedTasks.has(taskId)) {
        throw error;
      }
    } finally {
      this.finishLocalExecution(taskId);
    }
  }

  private async enqueueOne(task: BackgroundTask) {
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
    this.store([...current, pending]);

    try {
      const id = await NativeBackgroundTasks.enqueue(
        task.name,
        JSON.stringify(task),
        pending.meta.name,
        pending.meta.progressText || getString('common.preparing'),
        allowsDuplicateTask(task),
      );
      const latest = this.getSnapshot().filter(item => item.id !== pending.id);
      if (!latest.some(item => item.id === id)) {
        latest.push({ ...pending, id });
      }
      this.store(latest);
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
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) {
    const taskId = this.currentTaskId;
    if (!taskId) return;
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
    this.currentTaskId = undefined;
    this.interruptedTasks.delete(taskId);
  }

  private store(tasks: QueuedBackgroundTask[]) {
    setMMKVObject(BACKGROUND_TASKS_STORE_KEY, tasks);
  }
}
