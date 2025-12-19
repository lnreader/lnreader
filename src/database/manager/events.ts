import {
  type ListenerEvent,
  type ListenerFn,
  type ListenerHandle,
  type QueryCatalog,
  type QueryId,
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
      TCatalog[TId] extends { run: (ctx: any, params: infer P) => any }
        ? P
        : never,
      TCatalog[TId] extends { run: (ctx: any, params: any) => Promise<infer R> }
        ? R
        : unknown
    >,
  ): ListenerHandle {
    const events =
      this.listeners.get(queryId) ??
      new Map<ListenerEvent, Set<ListenerFn<any, any>>>();

    const set = events.get(event) ?? new Set<ListenerFn<any, any>>();
    set.add(listener);

    events.set(event, set);
    this.listeners.set(queryId, events);

    return {
      off: () => {
        set.delete(listener);
      },
    };
  }

  async emit<TId extends QueryId<TCatalog>>(
    queryId: TId,
    event: ListenerEvent,
    payload: Parameters<
      ListenerFn<
        TCatalog[TId] extends { run: (ctx: any, params: infer P) => any }
          ? P
          : never,
        TCatalog[TId] extends {
          run: (ctx: any, params: any) => Promise<infer R>;
        }
          ? R
          : unknown
      >
    >[0],
  ) {
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

