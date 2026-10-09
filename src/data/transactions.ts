/**
 * The ledger on disk: transactions and the movements they cause (SCHEMA §3.3, §3.4).
 * Financial fields are never updated in place; corrections are a reversal plus a replacement.
 */
import { Transaction } from '@/domain/ledger-types';
import { movementsOf } from '@/domain/ledger-movements';
import { SqlDriver } from './driver';
import { Row, fromRow, insertRow, updateRow } from './rows';

/** Fields that describe a transaction without changing its money (SYSTEM-OVERVIEW §6.7). */
export interface DescriptiveFields {
  note?: string | null;
  source?: string | null;
  label?: string | null;
  expenseCategory?: Transaction['expenseCategory'] | null;
  businessCostCategory?: Transaction['businessCostCategory'] | null;
}

const NUMERIC = new Set([
  'amount', 'advanceInstallment', 'reservePart', 'costRemoved', 'clearedAmount', 'totalOwed',
]);

export function transactionOf(row: Row): Transaction {
  const record = fromRow<Record<string, string | number>>(row);
  delete record.createdAt;
  delete record.updatedAt;
  delete record.replacedById;
  for (const key of NUMERIC) if (key in record) record[key] = Number(record[key]);
  return record as unknown as Transaction;
}

/** Every transaction, oldest first and in the order they were recorded. */
export async function loadTransactions(driver: SqlDriver): Promise<Transaction[]> {
  const rows = await driver.all('SELECT * FROM transactions ORDER BY date, created_at, rowid');
  return rows.map(transactionOf);
}

async function loadById(driver: SqlDriver, ids: readonly string[]): Promise<Transaction[]> {
  if (ids.length === 0) return [];
  const marks = ids.map(() => '?').join(', ');
  return (await driver.all(`SELECT * FROM transactions WHERE id IN (${marks})`, ids)).map(transactionOf);
}

async function originalsFor(driver: SqlDriver, batch: readonly Transaction[]): Promise<Map<string, Transaction>> {
  const inBatch = new Map(batch.map((tx) => [tx.id, tx]));
  const missing = batch.flatMap((tx) => (tx.reversesId && !inBatch.has(tx.reversesId) ? [tx.reversesId] : []));
  const stored = await loadById(driver, [...new Set(missing)]);
  return new Map([...inBatch, ...stored.map((tx): [string, Transaction] => [tx.id, tx])]);
}

/**
 * Writes transactions and their movements. Call inside `driver.transaction`, after the batch
 * passed `validateTransactions`; this function does not validate.
 */
export async function insertTransactions(driver: SqlDriver, batch: readonly Transaction[], now: string): Promise<void> {
  const originals = await originalsFor(driver, batch);
  for (const tx of batch) {
    await insertRow(driver, 'transactions', { ...tx, createdAt: now, updatedAt: now });
    const original = tx.reversesId === undefined ? undefined : originals.get(tx.reversesId);
    for (const [index, movement] of movementsOf(tx, original).entries()) {
      await insertRow(driver, 'movements', {
        id: `${tx.id}:${index}`,
        transactionId: tx.id,
        account: movement.account,
        refId: movement.refId,
        amount: movement.amount,
        date: movement.date,
      });
    }
  }
}

/** Records that an "Edit" replaced an original with a corrected transaction. */
export async function markReplaced(driver: SqlDriver, originalId: string, replacementId: string, now: string): Promise<void> {
  await updateRow(driver, 'transactions', originalId, { replacedById: replacementId, updatedAt: now });
}

export async function updateDescriptive(driver: SqlDriver, id: string, fields: DescriptiveFields, now: string): Promise<void> {
  await updateRow(driver, 'transactions', id, { ...fields, updatedAt: now });
}

/** Which originals were replaced by which corrected transaction. */
export async function loadReplacements(driver: SqlDriver): Promise<Map<string, string>> {
  const rows = await driver.all<{ id: string; replaced_by_id: string }>(
    'SELECT id, replaced_by_id FROM transactions WHERE replaced_by_id IS NOT NULL',
  );
  return new Map(rows.map((row) => [row.id, row.replaced_by_id]));
}
