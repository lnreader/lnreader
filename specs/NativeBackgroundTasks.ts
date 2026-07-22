import { TurboModule, TurboModuleRegistry } from 'react-native';

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

export interface Spec extends TurboModule {
  enqueue(
    type: string,
    payload: string,
    title: string,
    description: string,
    allowsDuplicates: boolean,
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
  complete(taskId: string): Promise<void>;
  fail(taskId: string, error: string, shouldRetry: boolean): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeBackgroundTasks');
