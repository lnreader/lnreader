import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type { schema } from './schema';

export type DrizzleDb = ExpoSQLiteDatabase<typeof schema>;

export interface DriverInitResult {
  db: DrizzleDb;
  /**
   * Raw sqlite instance used by the driver. Kept for advanced operations
   * such as migrations or custom pragmas.
   */
  raw: unknown;
}

export interface DriverFactory<TConfig = void> {
  (config?: TConfig): Promise<DriverInitResult> | DriverInitResult;
}

export type QueryKind = 'read' | 'write';

export interface QueryContext {
  db: DrizzleDb;
  schema: typeof schema;
}

export interface QuerySpec<TParams, TResult> {
  id: string;
  kind: QueryKind;
  description?: string;
  run: (ctx: QueryContext, params: TParams) => Promise<TResult>;
}

export type QueryCatalog = Record<string, QuerySpec<any, any>>;

export type QueryId<TCatalog extends QueryCatalog> = Extract<
  keyof TCatalog,
  string
>;

export type QueryParams<
  TCatalog extends QueryCatalog,
  TId extends QueryId<TCatalog>,
> = TCatalog[TId] extends QuerySpec<infer P, any> ? P : never;

export type QueryResult<
  TCatalog extends QueryCatalog,
  TId extends QueryId<TCatalog>,
> = TCatalog[TId] extends QuerySpec<any, infer R> ? R : never;

export interface QueueRetryOptions {
  maxRetries: number;
  backoffMs: number;
  retryOnMessageIncludes?: string[];
}

export interface QueueOptions {
  /**
   * Number of concurrent tasks. Keep at 1 to avoid SQLITE_BUSY when using
   * sync APIs on mobile.
   */
  concurrency: 1;
  retry?: Partial<QueueRetryOptions>;
}

export type ListenerEvent = 'before' | 'after' | 'error';

export interface ListenerPayload<TParams, TResult> {
  queryId: string;
  params: TParams;
  result?: TResult;
  error?: unknown;
}

export type ListenerFn<TParams, TResult> = (
  payload: ListenerPayload<TParams, TResult>,
) => void | Promise<void>;

export interface ListenerHandle {
  off: () => void;
}
