import BackgroundService from 'react-native-background-actions';
import * as Notifications from 'expo-notifications';

import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { importEpub } from './epub/import';
import { getString } from '@strings/translations';
import { updateLibrary } from './updates';
import { DriveFile } from '@api/drive/types';
import { createDriveBackup, driveRestore } from './backup/drive';
import {
  createSelfHostBackup,
  SelfHostData,
  selfHostRestore,
} from './backup/selfhost';
import { AppSettings, APP_SETTINGS } from '@hooks/persisted/useSettings';
import { createBackup, restoreBackup } from './backup/local';
import { migrateNovel, MigrateNovelData } from './migrate/migrateNovel';
import { downloadChapter } from './download/downloadChapter';
import { translateNovel } from './translate/translateNovel';
import { askForPostNotificationsPermission } from '@utils/askForPostNoftificationsPermission';

type taskNames =
  | 'IMPORT_EPUB'
  | 'UPDATE_LIBRARY'
  | 'DRIVE_BACKUP'
  | 'DRIVE_RESTORE'
  | 'SELF_HOST_BACKUP'
  | 'SELF_HOST_RESTORE'
  | 'LOCAL_BACKUP'
  | 'LOCAL_RESTORE'
  | 'MIGRATE_NOVEL'
  | 'DOWNLOAD_CHAPTER'
  | 'TRANSLATE_NOVEL';

export type BackgroundTask =
  | {
      name: 'IMPORT_EPUB';
      data: {
        filename: string;
        uri: string;
      };
    }
  | {
      name: 'UPDATE_LIBRARY';
      data?: {
        categoryId?: number;
        categoryName?: string;
      };
    }
  | { name: 'DRIVE_BACKUP'; data: DriveFile }
  | { name: 'DRIVE_RESTORE'; data: DriveFile }
  | { name: 'SELF_HOST_BACKUP'; data: SelfHostData }
  | { name: 'SELF_HOST_RESTORE'; data: SelfHostData }
  | { name: 'LOCAL_BACKUP' }
  | { name: 'LOCAL_RESTORE' }
  | { name: 'MIGRATE_NOVEL'; data: MigrateNovelData }
  | DownloadChapterTask
  | TranslateNovelTask;

export type DownloadChapterTask = {
  name: 'DOWNLOAD_CHAPTER';
  data: { chapterId: number; novelName: string; chapterName: string };
};

export type TranslateNovelTask = {
  name: 'TRANSLATE_NOVEL';
  data: { novelId: number; novelName: string; chapterIds: number[] };
};

export type BackgroundTaskMetadata = {
  name: string;
  isRunning: boolean;
  progress: number | undefined;
  progressText: string | undefined;
};

export type QueuedBackgroundTask = {
  task: BackgroundTask;
  meta: BackgroundTaskMetadata;
  id: string;
};

function makeId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export default class ServiceManager {
  STORE_KEY = 'APP_SERVICE';
  lastNotifUpdate = 0;
  currentPendingUpdate = 0;
  private static instance?: ServiceManager;

  private constructor() {}

  static get manager() {
    if (!this.instance) {
      this.instance = new ServiceManager();
    }
    return this.instance;
  }

  get isRunning() {
    return BackgroundService.isRunning();
  }

  isMultiplicableTask(task: BackgroundTask) {
    if (!task?.name) {
      return false;
    }
    return (
      [
        'DOWNLOAD_CHAPTER',
        'IMPORT_EPUB',
        'MIGRATE_NOVEL',
        'TRANSLATE_NOVEL',
      ] as Array<BackgroundTask['name']>
    ).includes(task.name);
  }

  async start() {
    if (!this.isRunning) {
      const notificationsAllowed = await askForPostNotificationsPermission();
      if (!notificationsAllowed) return;
      BackgroundService.start(ServiceManager.launch, {
        taskName: 'app_services',
        taskTitle: 'App Service',
        taskDesc: getString('common.preparing'),
        taskIcon: { name: 'notification_icon', type: 'drawable' },
        color: '#00adb5',
        linkingURI: 'lnreader://',
      }).catch(error => {
        Notifications.scheduleNotificationAsync({
          content: {
            title: getString('backupScreen.drive.backupInterruped'),
            body: error.message,
          },
          trigger: null,
        });
        BackgroundService.stop();
      });
    }
  }

  setMeta(
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
    taskId?: string,
  ) {
    const taskList = [...this.getTaskList()];
    const idx = taskId ? taskList.findIndex(t => t.id === taskId) : 0;
    const targetIdx = idx >= 0 ? idx : 0;
    if (taskList.length === 0 || !taskList[targetIdx]?.meta) {
      return;
    }

    taskList[targetIdx] = {
      ...taskList[targetIdx],
      meta: transformer(taskList[targetIdx].meta),
    };

    if (
      taskList[targetIdx].meta?.isRunning &&
      taskList[targetIdx].task?.name !== 'DOWNLOAD_CHAPTER' &&
      taskList[targetIdx].task?.name !== 'TRANSLATE_NOVEL'
    ) {
      const now = Date.now();
      if (now - this.lastNotifUpdate > 1000) {
        const delay = 1000 - now - this.lastNotifUpdate;
        const id = ++this.currentPendingUpdate;
        setTimeout(() => {
          if (this.currentPendingUpdate !== id) {
            return;
          }
          BackgroundService.updateNotification({
            taskTitle: taskList[targetIdx].meta?.name || 'Unknown Task',
            taskDesc: taskList[targetIdx].meta?.progressText ?? '',
            progressBar: {
              indeterminate: taskList[targetIdx].meta?.progress === undefined,
              value: (taskList[targetIdx].meta?.progress || 0) * 100,
              max: 100,
            },
          });
        }, delay);
      } else {
        this.lastNotifUpdate = now;
        BackgroundService.updateNotification({
          taskTitle: taskList[targetIdx].meta?.name || 'Unknown Task',
          taskDesc: taskList[targetIdx].meta?.progressText ?? '',
          progressBar: {
            indeterminate: taskList[targetIdx].meta?.progress === undefined,
            value: (taskList[targetIdx].meta?.progress || 0) * 100,
            max: 100,
          },
        });
      }
    }

    setMMKVObject(this.STORE_KEY, taskList);
  }

  //gets the progress bar for download chapters notification
  getProgressForNotification(
    currentTask: QueuedBackgroundTask,
    startingTasks: QueuedBackgroundTask[],
  ) {
    let i = null;
    let count = 0;
    for (const task of startingTasks) {
      if (
        task.task?.name === 'DOWNLOAD_CHAPTER' &&
        task.meta?.name === currentTask.meta?.name
      ) {
        if (task.id === currentTask.id) {
          i = count;
        }
        count++;
      } else {
        if (i !== null) {
          break;
        }
        count = 0;
      }
    }
    if (i === null) {
      return null;
    }
    return (i / count) * 100;
  }

  async executeTask(
    task: QueuedBackgroundTask,
    startingTasks: QueuedBackgroundTask[],
    setMetaFn?: (
      transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
    ) => void,
  ) {
    // Safety check for old format tasks
    if (!task?.task?.name) {
      return;
    }

    const setMeta = setMetaFn ?? this.setMeta.bind(this);

    const progress =
      task.task.name === 'DOWNLOAD_CHAPTER'
        ? this.getProgressForNotification(task, startingTasks)
        : null;
    await BackgroundService.updateNotification({
      taskTitle: task.meta?.name || 'Unknown Task',
      taskDesc: task.meta?.progressText ?? '',
      progressBar: {
        indeterminate: progress === null,
        max: 100,
        value: progress == null ? 0 : progress,
      },
    });
    this.lastNotifUpdate = Date.now();
    this.currentPendingUpdate = 0;

    switch (task.task.name) {
      case 'IMPORT_EPUB':
        return importEpub(task.task.data, setMeta);
      case 'UPDATE_LIBRARY':
        return updateLibrary(task.task.data || {}, setMeta);
      case 'DRIVE_BACKUP':
        return createDriveBackup(task.task.data, setMeta);
      case 'DRIVE_RESTORE':
        return driveRestore(task.task.data, setMeta);
      case 'SELF_HOST_BACKUP':
        return createSelfHostBackup(task.task.data, setMeta);
      case 'SELF_HOST_RESTORE':
        return selfHostRestore(task.task.data, setMeta);
      case 'LOCAL_BACKUP':
        return createBackup(setMeta);
      case 'LOCAL_RESTORE':
        return restoreBackup(setMeta);
      case 'MIGRATE_NOVEL':
        return migrateNovel(task.task.data, setMeta);
      case 'DOWNLOAD_CHAPTER':
        return downloadChapter(task.task.data, setMeta);
      case 'TRANSLATE_NOVEL':
        return translateNovel(task.task.data, setMeta);
    }
  }

  static async launch() {
    // retrieve class instance because this is running in different context
    const manager = ServiceManager.manager;
    const doneTasks: Record<BackgroundTask['name'], number> = {
      'IMPORT_EPUB': 0,
      'UPDATE_LIBRARY': 0,
      'DRIVE_BACKUP': 0,
      'DRIVE_RESTORE': 0,
      'SELF_HOST_BACKUP': 0,
      'SELF_HOST_RESTORE': 0,
      'LOCAL_BACKUP': 0,
      'LOCAL_RESTORE': 0,
      'MIGRATE_NOVEL': 0,
      'DOWNLOAD_CHAPTER': 0,
      'TRANSLATE_NOVEL': 0,
    };
    const startingTasks = manager.getTaskList();
    const tasksSet = new Set(startingTasks.map(t => t.id));
    const activePromises = new Map<string, Promise<void>>();

    while (BackgroundService.isRunning()) {
      const currentTasks = manager.getTaskList();

      // Add any newly queued tasks to the starting tasks list
      const newtasks = currentTasks.filter(t => !tasksSet.has(t.id));
      startingTasks.push(...newtasks);
      newtasks.forEach(t => tasksSet.add(t.id));

      const pendingTasks = currentTasks.filter(t => !activePromises.has(t.id));

      if (pendingTasks.length === 0 && activePromises.size === 0) {
        break; // No more tasks left and nothing running
      }

      while (activePromises.size < 5 && pendingTasks.length > 0) {
        const nextTask = pendingTasks[0];

        // Safety check - getTaskList() should already handle conversion, but double-check
        if (!nextTask?.task?.name) {
          pendingTasks.shift();
          const currentList = manager.getTaskList();
          setMMKVObject(
            manager.STORE_KEY,
            currentList.filter(t => t.id !== nextTask?.id),
          );
          continue;
        }

        const appSettings = (getMMKVObject<AppSettings>(APP_SETTINGS) ||
          {}) as Partial<AppSettings>;
        const isFastDownload =
          nextTask.task.name === 'DOWNLOAD_CHAPTER' && appSettings.fastDownload;

        if (!isFastDownload && activePromises.size > 0) {
          // If the next task is sequential, we MUST wait for all current fast tasks to finish
          break;
        }

        pendingTasks.shift(); // remove from local pending queue

        const worker = (async () => {
          try {
            const taskSetMeta = (
              transformer: (
                meta: BackgroundTaskMetadata,
              ) => BackgroundTaskMetadata,
            ) => manager.setMeta(transformer, nextTask.id);
            await manager.executeTask(nextTask, startingTasks, taskSetMeta);
            doneTasks[nextTask.task.name] += 1;
          } catch (error: any) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: nextTask.meta?.name || 'Task Error',
                body: error?.message || String(error),
              },
              trigger: null,
            });
          } finally {
            activePromises.delete(nextTask.id);
            // Remove completed task from queue in MMKV
            const currentList = manager.getTaskList();
            setMMKVObject(
              manager.STORE_KEY,
              currentList.filter(t => t.id !== nextTask.id),
            );
          }
        })();

        activePromises.set(nextTask.id, worker);

        if (!isFastDownload) {
          // Sequential task - don't start any more until this one is done
          break;
        }
      }

      if (activePromises.size > 0) {
        // Wait for exactly ONE promise to resolve, then the loop will repeat
        // and instantly pick up the next task in the queue to fill the slot.
        await Promise.race(activePromises.values());
      }
    }

    if (manager.getTaskList().length === 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: getString('common.done'),
          body: Object.keys(doneTasks)
            .filter(key => doneTasks[key as BackgroundTask['name']] > 0)
            .map(
              key =>
                `${getString(`notifications.${key as taskNames}`)}: ${
                  doneTasks[key as BackgroundTask['name']]
                }`,
            )
            .join('\n'),
        },
        trigger: null,
      });
    }
  }

  getTaskName(task: BackgroundTask) {
    if (!task?.name) {
      return 'Unknown Task';
    }
    switch (task.name) {
      case 'TRANSLATE_NOVEL':
        return `${getString('notifications.TRANSLATE_NOVEL')}: ${
          task.data?.novelName || ''
        }`;
      case 'DOWNLOAD_CHAPTER':
        return `${getString('notifications.DOWNLOAD_CHAPTER')}: ${
          task.data?.novelName || ''
        }`;
      case 'IMPORT_EPUB':
        return `${getString('notifications.IMPORT_EPUB')}: ${
          task.data?.filename || ''
        }`;
      case 'MIGRATE_NOVEL':
        return `${getString('notifications.MIGRATE_NOVEL')}: ${
          task.data?.fromNovel?.name || ''
        }`;
      case 'UPDATE_LIBRARY':
        if (task.data !== undefined) {
          return `${getString('notifications.UPDATE_LIBRARY')}: ${
            task.data?.categoryName || ''
          }`;
        }
        return getString('notifications.UPDATE_LIBRARY');
      case 'DRIVE_BACKUP':
        return getString('notifications.DRIVE_BACKUP');
      case 'DRIVE_RESTORE':
        return getString('notifications.DRIVE_RESTORE');
      case 'SELF_HOST_BACKUP':
        return getString('notifications.SELF_HOST_BACKUP');
      case 'SELF_HOST_RESTORE':
        return getString('notifications.SELF_HOST_RESTORE');
      case 'LOCAL_BACKUP':
        return getString('notifications.LOCAL_BACKUP');
      case 'LOCAL_RESTORE':
        return getString('notifications.LOCAL_RESTORE');
      default:
        return 'Unknown Task';
    }
  }

  getTaskList() {
    const tasks = getMMKVObject<Array<any>>(this.STORE_KEY) || [];

    const convertedTasks = tasks
      .map(task => {
        if (task?.task && task?.meta && task?.id) {
          return task as QueuedBackgroundTask;
        }

        if (task?.name && !task?.task) {
          const backgroundTask = task as BackgroundTask;
          return {
            task: backgroundTask,
            meta: {
              name: this.getTaskName(backgroundTask),
              isRunning: false,
              progress: undefined,
              progressText:
                backgroundTask.name === 'DOWNLOAD_CHAPTER'
                  ? (backgroundTask as DownloadChapterTask).data?.chapterName
                  : undefined,
            },
            id: makeId(),
          } as QueuedBackgroundTask;
        }

        return null;
      })
      .filter((task): task is QueuedBackgroundTask => task !== null);

    const hasOldFormat = tasks.some(task => task?.name && !task?.task);

    if (hasOldFormat) {
      setMMKVObject(this.STORE_KEY, convertedTasks);
    }

    return convertedTasks;
  }

  addTask(tasks: BackgroundTask | BackgroundTask[]) {
    const currentTasks = this.getTaskList();

    const addableTasks = (Array.isArray(tasks) ? tasks : [tasks]).filter(
      task =>
        this.isMultiplicableTask(task) ||
        !currentTasks.some(_t => _t.task?.name === task.name),
    );
    if (addableTasks.length) {
      const newTasks: QueuedBackgroundTask[] = addableTasks.map(task => ({
        task,
        meta: {
          name: this.getTaskName(task),
          isRunning: false,
          progress: undefined,
          progressText:
            task.name === 'DOWNLOAD_CHAPTER'
              ? task.data?.chapterName
              : undefined,
        },
        id: makeId(),
      }));

      setMMKVObject(this.STORE_KEY, currentTasks.concat(newTasks));
      this.start();
    }
  }

  removeTasksByName(name: BackgroundTask['name']) {
    const taskList = this.getTaskList();
    if (taskList[0]?.task?.name === name) {
      this.pause();
      setMMKVObject(
        this.STORE_KEY,
        taskList.filter(t => t.task?.name !== name),
      );
      this.resume();
    } else {
      setMMKVObject(
        this.STORE_KEY,
        taskList.filter(t => t.task?.name !== name),
      );
    }
  }

  clearTaskList() {
    setMMKVObject(this.STORE_KEY, []);
  }

  pause() {
    BackgroundService.stop();
  }

  resume() {
    this.start();
  }

  stop() {
    BackgroundService.stop();
    this.clearTaskList();
  }
}
