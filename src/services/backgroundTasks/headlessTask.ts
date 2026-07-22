import { initializeDatabase } from '@database/db';
import { initializeInstalledPlugins } from '@plugins/pluginManager';
import type { BackgroundTask, HeadlessBackgroundTaskData } from './contracts';
import { backgroundTasks } from './backgroundTasks';

export const runHeadlessBackgroundTask = async ({
  taskId,
  payload,
  checkpoint,
}: HeadlessBackgroundTaskData) => {
  await initializeDatabase();
  await initializeInstalledPlugins();
  await backgroundTasks.run(
    taskId,
    JSON.parse(payload) as BackgroundTask,
    checkpoint,
  );
};
