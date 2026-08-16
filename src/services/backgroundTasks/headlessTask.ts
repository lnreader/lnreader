import { initializeDatabase } from '@database/db';
import { initializeInstalledPlugins } from '@plugins/pluginManager';
import type { BackgroundTask, HeadlessBackgroundTaskData } from './contracts';
import { backgroundTasks } from './backgroundTasks';

export const runHeadlessBackgroundTask = async ({
  taskId,
  payload,
  checkpoint,
}: HeadlessBackgroundTaskData) => {
  // A headless run has no UI to unblock, and it does need every bundle on
  // disk, so unlike app startup it waits for the missing ones to be restored.
  const [, { repaired }] = await Promise.all([
    initializeDatabase(),
    initializeInstalledPlugins(),
  ]);
  await repaired;
  await backgroundTasks.run(
    taskId,
    JSON.parse(payload) as BackgroundTask,
    checkpoint,
  );
};
