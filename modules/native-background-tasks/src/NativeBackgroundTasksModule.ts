import { requireNativeModule } from 'expo-modules-core';

export type NativeBackgroundTaskSummary = {
  id: string;
  type: string;
  title: string;
  description?: string;
  state: string;
  progress?: number;
  progressText?: string;
  attempt: number;
  createdAt: number;
  updatedAt: number;
};

export type NativeBackgroundTaskRecord = NativeBackgroundTaskSummary & {
  payload: string;
  checkpoint?: string;
};

type NativeBackgroundTasksModule = {
  getTasks(): Promise<NativeBackgroundTaskSummary[]>;
  getTask(taskId: string): Promise<NativeBackgroundTaskRecord | null>;

  enqueue(
    type: string,
    payload: string,
    title: string,
    description: string,
    allowsDuplicates: boolean,
    queueName: string,
  ): Promise<string>;
  pause(taskId: string): Promise<void>;
  resume(taskId: string): Promise<void>;
  cancel(taskId: string): Promise<void>;
  updateProgress(
    taskId: string,
    progress: number,
    progressText: string,
  ): Promise<void>;
  updateCheckpoint(taskId: string, checkpoint: string): Promise<void>;
  postWarning(taskId: string, title: string, message: string): Promise<void>;
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
