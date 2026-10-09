/**
 * Export and import of all data (SYSTEM-OVERVIEW §11). The payload is plain JSON of every table;
 * backup-crypto.ts seals it. Import replaces everything in one database transaction, and only after
 * the balances recomputed from the transactions match the stored movements.
 */
import { allMovements } from '@/domain/ledger-movements';
import { Account } from '@/domain/ledger-types';
import { SqlDriver, SqlValue } from './driver';
import { CURRENT_SCHEMA_VERSION, TABLES_IN_RESTORE_ORDER, TableName } from './schema';
import { transactionOf } from './transactions';
import { Row } from './rows';

export const PAYLOAD_FORMAT = 'vanea-backup-data';

export type TableRows = Record<TableName, Row[]>;

export interface BackupPayload {
  format: typeof PAYLOAD_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  data: TableRows;
}

export interface BackupSummary {
  exportedAt: string;
  firstTransactionDate: string | null;
  lastTransactionDate: string | null;
  counts: Record<TableName, number>;
  /** Balances recomputed from the transactions. */
  balances: { pool: number; personal: number; savings: number };
}

export class InvalidPayloadError extends Error {
  constructor(reason: string) {
    super(`This backup cannot be restored: ${reason}`);
    this.name = 'InvalidPayloadError';
  }
}

export async function exportPayload(driver: SqlDriver, meta: { exportedAt: string; appVersion: string }): Promise<BackupPayload> {
  const data = {} as TableRows;
  for (const table of TABLES_IN_RESTORE_ORDER) data[table] = await driver.all<Row>(`SELECT * FROM ${table}`);
  return { format: PAYLOAD_FORMAT, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: meta.exportedAt, appVersion: meta.appVersion, data };
}

export function parsePayload(text: string): BackupPayload {
  let payload: Partial<BackupPayload>;
  try {
    payload = JSON.parse(text) as Partial<BackupPayload>;
  } catch {
    throw new InvalidPayloadError('the data is damaged');
  }
  if (payload.format !== PAYLOAD_FORMAT) throw new InvalidPayloadError('unknown data format');
  if (typeof payload.schemaVersion !== 'number' || payload.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new InvalidPayloadError('it was made by a newer version of Vanea');
  }
  if (payload.schemaVersion < CURRENT_SCHEMA_VERSION) throw new InvalidPayloadError('it was made by an older version that cannot be upgraded');
  for (const table of TABLES_IN_RESTORE_ORDER) {
    if (!Array.isArray(payload.data?.[table])) throw new InvalidPayloadError(`the ${table} data is missing`);
  }
  return payload as BackupPayload;
}

function totals(rows: readonly { account: string; refId?: string | null; amount: number }[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.account}|${row.refId ?? ''}`;
    result.set(key, (result.get(key) ?? 0) + Number(row.amount));
  }
  return result;
}

/** The stored movements must equal what the transactions imply, account by account. */
export function verifyBalances(payload: BackupPayload): void {
  const derived = totals(allMovements(payload.data.transactions.map(transactionOf)));
  const stored = totals(payload.data.movements.map((row) => ({ account: String(row.account), refId: row.ref_id as string | null, amount: Number(row.amount) })));
  for (const key of new Set([...derived.keys(), ...stored.keys()])) {
    if ((derived.get(key) ?? 0) !== (stored.get(key) ?? 0)) throw new InvalidPayloadError(`the ${key.split('|')[0]} balance does not add up`);
  }
}

export function summarize(payload: BackupPayload): BackupSummary {
  const counts = Object.fromEntries(TABLES_IN_RESTORE_ORDER.map((t) => [t, payload.data[t].length])) as Record<TableName, number>;
  const dates = payload.data.transactions.map((row) => String(row.date)).sort();
  const sums = totals(allMovements(payload.data.transactions.map(transactionOf)));
  const balance = (account: Account) => sums.get(`${account}|`) ?? 0;
  return {
    exportedAt: payload.exportedAt,
    firstTransactionDate: dates[0] ?? null,
    lastTransactionDate: dates[dates.length - 1] ?? null,
    counts,
    balances: { pool: balance('pool'), personal: balance('personal'), savings: balance('savings') },
  };
}

async function insertAll(driver: SqlDriver, table: TableName, rows: readonly Row[]): Promise<void> {
  for (const row of rows) {
    const columns = Object.keys(row);
    const marks = columns.map(() => '?').join(', ');
    await driver.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${marks})`, columns.map((c) => row[c] as SqlValue));
  }
}

/** Replaces all data with the payload's, in one transaction. A failure leaves the current data untouched. */
export async function importPayload(driver: SqlDriver, payload: BackupPayload): Promise<void> {
  verifyBalances(payload);
  await driver.transaction(async () => {
    await driver.exec('PRAGMA defer_foreign_keys = ON');
    for (const table of [...TABLES_IN_RESTORE_ORDER].reverse()) await driver.run(`DELETE FROM ${table}`);
    for (const table of TABLES_IN_RESTORE_ORDER) await insertAll(driver, table, payload.data[table]);
  });
}
