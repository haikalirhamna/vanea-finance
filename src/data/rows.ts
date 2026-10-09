/** Mapping between camelCase records and snake_case rows, and the small SQL builders the repositories share. */
import { SqlDriver, SqlValue } from './driver';

export type Row = Record<string, SqlValue>;

export function toSnake(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** A record as a row: keys in snake_case, `undefined` left out, booleans as 0/1. */
export function toRow(record: object): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    row[toSnake(key)] = typeof value === 'boolean' ? Number(value) : (value as SqlValue);
  }
  return row;
}

/** A row as a record: keys in camelCase, `null` columns left out so optional fields stay optional. */
export function fromRow<T>(row: Row): T {
  const record: Record<string, SqlValue> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null) record[toCamel(key)] = value;
  }
  return record as T;
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function assertIdentifier(name: string): void {
  if (!IDENTIFIER.test(name)) throw new Error(`Not a safe SQL identifier: ${name}`);
}

export async function insertRow(driver: SqlDriver, table: string, record: object): Promise<void> {
  const row = toRow(record);
  const columns = Object.keys(row);
  assertIdentifier(table);
  columns.forEach(assertIdentifier);
  const marks = columns.map(() => '?').join(', ');
  await driver.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${marks})`, columns.map((c) => row[c]!));
}

/** Updates the given columns of one row by id. Columns set to `null` are cleared. */
export async function updateRow(driver: SqlDriver, table: string, id: string, patch: object): Promise<void> {
  const row = toRow(patch);
  const columns = Object.keys(row);
  if (columns.length === 0) return;
  assertIdentifier(table);
  columns.forEach(assertIdentifier);
  const assignments = columns.map((c) => `${c} = ?`).join(', ');
  await driver.run(`UPDATE ${table} SET ${assignments} WHERE id = ?`, [...columns.map((c) => row[c]!), id]);
}
