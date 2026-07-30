import {
  createSqliteAdapter,
  classifySqlStatement,
  SqliteQueryResult,
} from '@rozenite/sqlite-plugin';
import { db } from '@database/db';

/**
 * Columns from op-sqlite's QueryResult may be undefined when the native layer
 * returns keyed rows directly.  Always derive a usable column list, falling
 * back to the keys of the first row object.
 */
const deriveColumns = (
  columnNames: string[] | undefined,
  firstRow: Record<string, unknown> | undefined,
): string[] => {
  if (columnNames && columnNames.length > 0) {
    return columnNames;
  }
  if (firstRow) {
    return Object.keys(firstRow);
  }
  return [];
};

/**
 * op-sqlite's enhanced `execute` wrapper only reconstructs rows from rawRows
 * when `result.rows` is falsy — but an empty array `[]` is truthy in JS, so
 * the fallback is skipped.  We handle the same reconstruction ourselves to
 * stay robust across all op-sqlite versions.
 */
const reconstructRows = (
  rows: unknown,
  rawRows: unknown,
  columnNames: string[] | undefined,
): Record<string, unknown>[] => {
  if (Array.isArray(rows) && rows.length > 0) {
    return rows as Record<string, unknown>[];
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return [];
  }

  const cols = deriveColumns(columnNames, undefined);

  if (cols.length === 0) {
    // No column info at all — return raw rows as value-only arrays
    return rawRows as unknown as Record<string, unknown>[];
  }

  return rawRows.map((rawRow: unknown) => {
    const row: Record<string, unknown> = {};
    const values = rawRow as unknown[];
    for (let j = 0; j < cols.length; j++) {
      row[cols[j]!] = values[j];
    }
    return row;
  });
};

/**
 * Rozenite SQLite adapter for @op-engineering/op-sqlite.
 *
 * Gated to `__DEV__`; import and pass to `useRozeniteSqlitePlugin` only
 * during development builds.
 */
export const opSqliteAdapter = __DEV__
  ? createSqliteAdapter({
      adapterId: 'op-sqlite',
      adapterName: 'OP SQLite',
      databases: {
        main: {
          name: 'lnreader.db',
          executeStatements: async statements => {
            const results: SqliteQueryResult[] = [];

            for (const stmt of statements) {
              const start = performance.now();
              const result = await db.execute(
                stmt.sql,
                stmt.params as any[] | undefined,
              );
              const duration = performance.now() - start;

              const rows = reconstructRows(
                result.rows,
                (result as any).rawRows,
                result.columnNames,
              );
              const columns = deriveColumns(result.columnNames, rows[0]);

              results.push({
                rows,
                columns,
                metadata: {
                  statementType: classifySqlStatement(stmt.sql),
                  rowCount: rows.length,
                  changes: result.rowsAffected ?? null,
                  lastInsertRowId: result.insertId ?? null,
                  durationMs: duration,
                },
              });
            }

            return results;
          },
        },
      },
    })
  : null;
