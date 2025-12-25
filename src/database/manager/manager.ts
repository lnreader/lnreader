import { drizzleDb } from '@database/db';
import { IDbManager } from './manager.d';

type DrizzleDb = typeof drizzleDb;
type TransactionParameter = Parameters<
  Parameters<DrizzleDb['transaction']>[0]
>[0];

let _dbManager: DbManager;

class DbManager implements IDbManager {
  private readonly db: DrizzleDb;

  public readonly select: DrizzleDb['select'];
  public readonly selectDistinct: DrizzleDb['selectDistinct'];
  public readonly $count: DrizzleDb['$count'];
  public readonly query: DrizzleDb['query'];
  public readonly run: DrizzleDb['run'];
  public readonly transaction: DrizzleDb['transaction'];
  public readonly with: DrizzleDb['with'];
  public readonly $with: DrizzleDb['$with'];
  public readonly all: DrizzleDb['all'];
  public readonly get: DrizzleDb['get'];
  public readonly values: DrizzleDb['values'];

  private constructor(db: DrizzleDb) {
    this.db = db;
    this.select = this.db.select.bind(this.db);
    this.selectDistinct = this.db.selectDistinct.bind(this.db);
    this.$count = this.db.$count.bind(this.db);
    this.query = this.db.query;
    this.run = this.db.run.bind(this.db);
    this.transaction = this.db.transaction.bind(this.db);
    this.with = this.db.with.bind(this.db);
    this.$with = this.db.$with.bind(this.db);
    this.all = this.db.all.bind(this.db);
    this.get = this.db.get.bind(this.db);
    this.values = this.db.values.bind(this.db);
  }

  public static create(db: DrizzleDb): DbManager {
    if (_dbManager) return _dbManager;
    _dbManager = new DbManager(db);
    return _dbManager;
  }

  public async write<T>(
    fn: (tx: TransactionParameter) => Promise<T>,
  ): Promise<T> {
    return await this.db.transaction(async tx => {
      return await fn(tx);
    });
  }
}

export const createDbManager = (db: DrizzleDb) => {
  return DbManager.create(db);
};
