/**
 * The only thing the repositories know about SQLite. Two implementations:
 * expo-sqlite with SQLCipher on the phone, and sql.js (real SQLite in JavaScript) in tests and the web preview.
 */
export type SqlValue = string | number | null;

export interface SqlDriver {
  /** Runs one or more statements without parameters (schema, pragmas). */
  exec(sql: string): Promise<void>;
  /** Runs one statement. */
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  /** Runs a query and returns every row as an object keyed by column name. */
  all<T = Record<string, SqlValue>>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /** Runs the work in one database transaction: all of it is written, or none. Do not nest. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** The first row, or null. */
export async function first<T = Record<string, SqlValue>>(
  driver: SqlDriver,
  sql: string,
  params: readonly SqlValue[] = [],
): Promise<T | null> {
  const rows = await driver.all<T>(sql, params);
  return rows[0] ?? null;
}
