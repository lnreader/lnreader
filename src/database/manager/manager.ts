import { schema } from './schema';
import { DbTaskQueue } from './queue';
import { QueryEventBus } from './events';
import {
  type QueryCatalog,
  type QueryId,
  type QueryParams,
  type QueryResult,
  type QueueOptions,
  type DriverFactory,
  type QueryContext,
  type ListenerEvent,
  type ListenerFn,
  type ListenerHandle,
} from './types';

export interface DbManagerOptions {
  queue?: Partial<QueueOptions>;
}

export class DbManager<TCatalog extends QueryCatalog> {
  private readonly driverFactory: DriverFactory;
  private readonly catalog: TCatalog;
  private readonly queue: DbTaskQueue;
  private readonly events: QueryEventBus<TCatalog>;
  private ctx: QueryContext | null = null;

  constructor(
    catalog: TCatalog,
    driverFactory: DriverFactory,
    options?: DbManagerOptions,
  ) {
    this.catalog = catalog;
    this.driverFactory = driverFactory;
    this.queue = new DbTaskQueue(options?.queue);
    this.events = new QueryEventBus<TCatalog>();
  }

  async init(): Promise<void> {
    if (this.ctx) return;
    const { db } = await this.driverFactory();
    this.ctx = { db, schema };
  }

  on<TId extends QueryId<TCatalog>>(
    queryId: TId,
    event: ListenerEvent,
    listener: ListenerFn<
      QueryParams<TCatalog, TId>,
      QueryResult<TCatalog, TId>
    >,
  ): ListenerHandle {
    return this.events.on(queryId, event, listener);
  }

  async execute<TId extends QueryId<TCatalog>>(
    queryId: TId,
    params: QueryParams<TCatalog, TId>,
  ): Promise<QueryResult<TCatalog, TId>> {
    await this.init();
    return this.queue.enqueue({
      id: queryId,
      run: () => this.runQuery(queryId, params),
    });
  }

  private async runQuery<TId extends QueryId<TCatalog>>(
    queryId: TId,
    params: QueryParams<TCatalog, TId>,
  ): Promise<QueryResult<TCatalog, TId>> {
    if (!this.ctx) {
      await this.init();
    }

    const spec = this.catalog[queryId];
    if (!spec) {
      throw new Error(`Unknown queryId: ${String(queryId)}`);
    }

    await this.events.emit(queryId, 'before', { queryId, params });

    try {
      const result = await spec.run(this.ctx as QueryContext, params);
      await this.events.emit(queryId, 'after', { queryId, params, result });
      return result as QueryResult<TCatalog, TId>;
    } catch (error) {
      await this.events.emit(queryId, 'error', { queryId, params, error });
      throw error;
    }
  }
}

