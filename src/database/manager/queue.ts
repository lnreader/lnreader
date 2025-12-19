import { sleep } from '@utils/sleep';
import type { QueueOptions } from './types';

type TaskRunner<TResult> = () => Promise<TResult>;

interface DbTask<TResult = unknown> {
  id: string;
  attempt: number;
  run: TaskRunner<TResult>;
  resolve: (value: TResult | Promise<TResult>) => void;
  reject: (reason?: unknown) => void;
}

const DEFAULT_RETRY_ON = ['SQLITE_BUSY', 'database is locked'];

export class DbTaskQueue {
  private readonly options: QueueOptions;
  private readonly queue: DbTask[] = [];
  private active = false;

  constructor(options?: Partial<QueueOptions>) {
    this.options = {
      concurrency: 1,
      retry: {
        maxRetries: 2,
        backoffMs: 50,
        retryOnMessageIncludes: DEFAULT_RETRY_ON,
        ...options?.retry,
      },
      ...options,
    };
  }

  enqueue<TResult>(task: Pick<DbTask<TResult>, 'id' | 'run'>): Promise<TResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...task, attempt: 0, resolve, reject });
      void this.drain();
    });
  }

  private async drain() {
    if (this.active) return;
    this.active = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) continue;

      try {
        const result = await task.run();
        task.resolve(result);
      } catch (error) {
        const shouldRetry = this.shouldRetry(error, task.attempt);
        if (shouldRetry) {
          task.attempt += 1;
          this.queue.unshift(task);
          await sleep(this.options.retry?.backoffMs ?? 0);
          continue;
        }
        task.reject(error);
      }
    }

    this.active = false;
  }

  private shouldRetry(error: unknown, attempt: number): boolean {
    const retryCfg = this.options.retry;
    if (!retryCfg) return false;

    if (attempt >= (retryCfg.maxRetries ?? 0)) {
      return false;
    }

    const message =
      error instanceof Error ? error.message : String(error ?? '');

    return (retryCfg.retryOnMessageIncludes ?? DEFAULT_RETRY_ON).some(pattern =>
      message.includes(pattern),
    );
  }
}

