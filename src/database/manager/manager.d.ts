// db-manager.types.ts
import type {
  BaseSQLiteDatabase,
  SQLiteCountBuilder,
  SQLiteSelectBuilder,
} from 'drizzle-orm/sqlite-core'; // Adjust this import based on your actual Drizzle setup (e.g., 'drizzle-orm/pg-core', 'drizzle-orm/mysql-core')
import type {
  DrizzleTypeError,
  ExtractTablesWithRelations,
  RelationalSchemaConfig,
  SelectedFields,
  SQLiteTransaction,
  SQLiteTransactionConfig,
  TablesRelationalConfig,
} from 'drizzle-orm';
import type { ColumnsSelection, SQL, SQLWrapper } from 'drizzle-orm/sql';
import type {
  WithSubquery,
  WithSubqueryWithSelection,
} from 'drizzle-orm/subquery';
import type {
  QueryBuilder,
  RelationalQueryBuilder,
  SQLiteDeleteBase,
  SQLiteInsertBuilder,
  SQLiteTable,
  SQLiteUpdateBuilder,
  SQLiteViewBase,
} from 'drizzle-orm/sqlite-core'; // Adjust based on your adapter
import type { DBResult, Result } from 'drizzle-orm/session'; // This might vary slightly based on your adapter's session

// Define the TransactionParameter type based on your DrizzleDb
export type TransactionParameter = SQLiteTransaction<
  'async',
  { changes: number; lastInsertRowid: number } | void,
  Record<string, unknown>,
  TablesRelationalConfig
>;

/**
 * Interface defining the public API and documentation for the Drizzle database manager.
 * This contract ensures consistent documentation and type safety across the application.
 */
export interface IDbManager {
  /**
   * Creates a subquery that defines a temporary named result set as a CTE.
   *
   * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param alias The alias for the subquery.
   *
   * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
   *
   * @example
   *
   * ```ts
   * // Create a subquery with alias 'sq' and use it in the select query
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * const result = await db.with(sq).select().from(sq);
   * ```
   *
   * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
   *
   * ```ts
   * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
   * const sq = db.$with('sq').as(db.select({
   *   name: sql<string>`upper(${users.name})`.as('name'),
   * })
   * .from(users));
   *
   * const result = await db.with(sq).select({ name: sq.name }).from(sq);
   * ```
   */
  $with: any;

  /**
   * Builds a count query.
   *
   * This method is used to count the number of rows that match a specific condition.
   * It can be used with a table, view, or raw SQL expression as the source.
   *
   * @param source The table, view, SQL, or SQLWrapper to count from.
   * @param filters Optional SQL expression for filtering rows before counting.
   * @returns A query builder for counting data.
   *
   * @example
   * ```ts
   * // Count all users
   * const totalUsers = await db.$count(users);
   *
   * // Count active users
   * const activeUsers = await db.$count(users, eq(users.status, 'active'));
   * ```
   */
  $count: any;

  /**
   * Provides access to relational queries defined by your Drizzle schema.
   *
   * This object allows you to build complex queries involving relations between tables,
   * leveraging the schema you've defined.
   *
   * See docs: {@link https://orm.drizzle.team/docs/relations}
   */
  readonly query: any;

  /**
   * Incorporates a previously defined CTE (using `$with`) into the main query.
   *
   * This method allows the main query to reference a temporary named result set.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param queries The CTEs to incorporate into the main query.
   *
   * @example
   *
   * ```ts
   * // Define a subquery 'sq' as a CTE using $with
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * // Incorporate the CTE 'sq' into the main query and select from it
   * const result = await db.with(sq).select().from(sq);
   * ```
   */
  with: any;

  /**
   * Creates a select query.
   *
   * Calling this method with no arguments will select all columns from the table. Pass a selection object to specify the columns you want to select.
   *
   * Use `.from()` method to specify which table to select from.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select}
   *
   * @param fields The selection object.
   *
   * @example
   *
   * ```ts
   * // Select all columns and all rows from the 'cars' table
   * const allCars: Car[] = await db.select().from(cars);
   *
   * // Select specific columns and all rows from the 'cars' table
   * const carsIdsAndBrands: { id: number; brand: string }[] = await db.select({
   *   id: cars.id,
   *   brand: cars.brand
   * })
   *   .from(cars);
   * ```
   *
   * Like in SQL, you can use arbitrary expressions as selection fields, not just table columns:
   *
   * ```ts
   * // Select specific columns along with expression and all rows from the 'cars' table
   * const carsIdsAndLowerNames: { id: number; lowerBrand: string }[] = await db.select({
   *   id: cars.id,
   *   lowerBrand: sql<string>`lower(${cars.brand})`,
   * })
   *   .from(cars);
   * ```
   */
  select: any;

  /**
   * Adds `distinct` expression to the select query.
   *
   * Calling this method will return only unique values. When multiple columns are selected, it returns rows with unique combinations of values in these columns.
   *
   * Use `.from()` method to specify which table to select from.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#distinct}
   *
   * @param fields The selection object.
   *
   * @example
   *
   * ```ts
   * // Select all unique rows from the 'cars' table
   * await db.selectDistinct()
   *   .from(cars)
   *   .orderBy(cars.id, cars.brand, cars.color);
   *
   * // Select all unique brands from the 'cars' table
   * await db.selectDistinct({ brand: cars.brand })
   *   .from(cars)
   *   .orderBy(cars.brand);
   * ```
   */
  selectDistinct: any;

  /**
   * Executes a raw SQL query or an {@link SQLWrapper} expression.
   *
   * This method is suitable for queries that don't return rows (e.g., DDL statements,
   * or operations that only return affected rows/last insert ID).
   *
   * @param query The SQL query or {@link SQLWrapper} to execute.
   * @returns A promise resolving to the database result, which typically includes
   *          information about the operation's effect (e.g., number of affected rows).
   *
   * @example
   * ```ts
   * await db.run(sql`DELETE FROM users WHERE id = 1`);
   * ```
   *
   * @see https://orm.drizzle.team/docs/advanced-queries#run-raw-sql
   */
  run: any;

  /**
   * Executes a raw SQL query or an {@link SQLWrapper} expression and returns all resulting rows.
   *
   * This is useful for fetching multiple records that don't fit into Drizzle's ORM builders,
   * or when you need full control over the SQL.
   *
   * @param query The SQL query or {@link SQLWrapper} to execute.
   * @returns A promise resolving to an array of results, with each element typed as `T`.
   *          Defaults to `unknown[]` if `T` is not specified.
   *
   * @example
   * ```ts
   * const users = await db.all<{ id: number; name: string }>(sql`SELECT id, name FROM users`);
   * ```
   *
   * @see https://orm.drizzle.team/docs/advanced-queries#run-raw-sql
   */
  all: any;

  /**
   * Executes a raw SQL query or an {@link SQLWrapper} expression and returns a single row.
   *
   * This is ideal for queries expected to return zero or one record.
   *
   * @param query The SQL query or {@link SQLWrapper} to execute.
   * @returns A promise resolving to a single result of type `T`, or `undefined` if no row is found.
   *          Defaults to `unknown` if `T` is not specified.
   *
   * @example
   * ```ts
   * const user = await db.get<{ id: number; name: string }>(sql`SELECT id, name FROM users WHERE id = 1`);
   * ```
   *
   * @see https://orm.drizzle.team/docs/advanced-queries#run-raw-sql
   */
  get: any;

  /**
   * Executes a raw SQL query or an {@link SQLWrapper} expression and returns all results as an array of arrays (values).
   *
   * This is typically used when you only need the raw column values without column names,
   * often for performance or specific driver requirements.
   *
   * @param query The SQL query or {@link SQLWrapper} to execute.
   * @returns A promise resolving to an array of arrays, where each inner array represents
   *          a row's values. Defaults to `unknown[]` if `T` is not specified.
   *
   * @example
   * ```ts
   * const userValues = await db.values<[number, string]>(sql`SELECT id, name FROM users`);
   * // userValues might look like [[1, 'Alice'], [2, 'Bob']]
   * ```
   *
   * @see https://orm.drizzle.team/docs/advanced-queries#run-raw-sql
   */
  values: any;

  /**
   * Executes a series of database operations within a single transaction.
   *
   * All operations within the provided function will either succeed completely or fail completely,
   * ensuring data integrity.
   *
   * See docs: {@link https://orm.drizzle.team/docs/transactions}
   *
   * @param transaction A function containing the database operations to be performed within the transaction.
   *                    It receives a transaction client (`tx`) as an argument.
   * @param config Optional configuration for the transaction (e.g., isolation level).
   * @returns A promise resolving to the result of the `transaction` function.
   *
   * @example
   * ```ts
   * await db.transaction(async (tx) => {
   *   await tx.insert(users).values({ name: 'Alice' });
   *   await tx.update(products).set({ stock: 0 }).where(eq(products.id, 1));
   * });
   * ```
   */
  transaction: any;

  /**
   * Performs write operations within a transaction.
   * This method ensures atomicity for a block of operations that modify data.
   *
   * (No specific documentation beyond this general description as per request)
   */
  write<T>(fn: (tx: TransactionParameter) => Promise<T>): Promise<T>;
}
