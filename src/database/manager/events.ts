import {
  type ListenerEvent,
  type ListenerFn,
  type ListenerHandle,
  type QueryCatalog,
  type QueryId,
  type QueryParams,
  type QueryResult,
} from './types';

export class QueryEventBus<TCatalog extends QueryCatalog> {
  private listeners: Map<
    QueryId<TCatalog>,
    Map<ListenerEvent, Set<ListenerFn<any, any>>>
  > = new Map();

  on<TId extends QueryId<TCatalog>>(
    queryId: TId,
    event: ListenerEvent,
    listener: ListenerFn<
      QueryParams<TCatalog, TId>,
      QueryResult<TCatalog, TId>
    >,
  ): ListenerHandle {
    const events =
      this.listeners.get(queryId) ??
      new Map<ListenerEvent, Set<ListenerFn<any, any>>>();

    const set = events.get(event) ?? new Set<ListenerFn<any, any>>();
    set.add(listener as ListenerFn<any, any>);

    events.set(event, set);
    this.listeners.set(queryId, events);

    return {
      off: () => {
        set.delete(listener as ListenerFn<any, any>);
      },
    };
  }

  async emit<TId extends QueryId<TCatalog>>(
    queryId: TId,
    event: ListenerEvent,
    payload: {
      queryId: string;
      params: QueryParams<TCatalog, TId>;
      result?: QueryResult<TCatalog, TId>;
      error?: unknown;
    },
  ): Promise<void> {
    const events = this.listeners.get(queryId);
    const listeners = events?.get(event);
    if (!listeners?.size) {
      return;
    }

    await Promise.all(
      Array.from(listeners).map(listener => Promise.resolve(listener(payload))),
    );
  }
}
