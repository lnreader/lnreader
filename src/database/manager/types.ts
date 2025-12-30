export interface QueueOptions {
  concurrency?: number;
  retry?: {
    maxRetries?: number;
    backoffMs?: number;
    retryOnMessageIncludes?: string[];
  };
}


