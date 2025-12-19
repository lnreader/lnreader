import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { DriverFactory } from '../types';

export interface OpSqliteAdapter {
  all: (query: string, params?: any[]) => Promise<any[]> | any[];
  get: (query: string, params?: any[]) => Promise<any> | any;
  run: (query: string, params?: any[]) => Promise<any> | any;
  values?: (query: string, params?: any[]) => Promise<any[][]> | any[][];
  exec?: (query: string) => Promise<void> | void;
}

export interface OpSqliteDriverOptions {
  adapter: OpSqliteAdapter;
  applyPragmas?: string[];
}

export const createOpSqliteDriver: DriverFactory<OpSqliteDriverOptions> = (
  options,
) => {
    if (!options?.adapter) {
      throw new Error('op-sqlite adapter is required to create the driver');
    }

    if (options.applyPragmas?.length && options.adapter.exec) {
      for (const pragma of options.applyPragmas) {
        void options.adapter.exec(pragma);
      }
    }

    const db = drizzle(async (query, params, method) => {
      switch (method) {
        case 'all':
          return options.adapter.all(query, params);
        case 'get':
          return options.adapter.get(query, params);
        case 'run':
          return options.adapter.run(query, params);
        case 'values':
          if (options.adapter.values) {
            return options.adapter.values(query, params);
          }
          return options.adapter.all(query, params).map(row =>
            Object.values(row ?? {}),
          );
        default:
          throw new Error(`Unsupported sqlite-proxy method: ${String(method)}`);
      }
    });

    return {
      db,
      raw: options.adapter,
    };
  };

