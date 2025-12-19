import { createExpoSqliteDriver, type ExpoSqliteDriverOptions } from './driver/expoSqlite';
import { createOpSqliteDriver, type OpSqliteDriverOptions } from './driver/opSqlite';
import { DbManager, type DbManagerOptions } from './manager';
import { queryCatalog, type DatabaseQueryCatalog, type DatabaseQueryId } from './queries';
import { type QueryResult, type QueryParams } from './types';

export type { DatabaseQueryCatalog, DatabaseQueryId };
export type { QueryResult, QueryParams };
export type { ExpoSqliteDriverOptions, OpSqliteDriverOptions };
export { queryCatalog };

export const createDatabaseManager = (
  options?: DbManagerOptions & {
    expo?: ExpoSqliteDriverOptions;
  },
) => new DbManager<DatabaseQueryCatalog>(queryCatalog, () =>
  createExpoSqliteDriver(options?.expo),
  { queue: options?.queue },
);

export const dbManager = createDatabaseManager();
export { DbManager, createExpoSqliteDriver, createOpSqliteDriver };

