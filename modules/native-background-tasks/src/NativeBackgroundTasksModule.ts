import { requireNativeModule } from 'expo-modules-core';

export type NativeBackgroundTaskRecord = {
  id: string;
  type: string;
  payload: string;
  title: string;
  description?: string;
  state: string;
  progress?: number;
  progressText?: string;
  checkpoint?: string;
  attempt: number;
  createdAt: number;
  updatedAt: number;
};

type NativeBackgroundTasksModule = {
  enqueue(
    type: string,
    payload: string,
    title: string,
    description: string,
    allowsDuplicates: boolean,
    queueName: string,
  ): Promise<string>;
  getTasks(): Promise<NativeBackgroundTaskRecord[]>;
  pause(taskId: string): Promise<void>;
  resume(taskId: string): Promise<void>;
  cancel(taskId: string): Promise<void>;
  updateProgress(
    taskId: string,
    progress: number,
    progressText: string,
  ): Promise<void>;
  updateCheckpoint(taskId: string, checkpoint: string): Promise<void>;
  complete(taskId: string, completionText: string): Promise<void>;
  fail(taskId: string, error: string, shouldRetry: boolean): Promise<void>;
  scheduleLibraryUpdates(
    intervalHours: number,
    title: string,
    description: string,
  ): Promise<void>;
  cancelLibraryUpdates(): Promise<void>;
  scheduleAutomaticBackups(
    intervalHours: number,
    title: string,
    description: string,
    directoryUri: string,
  ): Promise<void>;
  cancelAutomaticBackups(): Promise<void>;
};

export default requireNativeModule<NativeBackgroundTasksModule>(
  'NativeBackgroundTasks',
);
