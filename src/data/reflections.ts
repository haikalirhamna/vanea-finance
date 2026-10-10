/** Monthly intentions and reflections (SCHEMA §3.10, §3.11). */
import { Month } from '@/domain/calendar';
import { SqlDriver } from './driver';
import { Row, fromRow, insertRow, updateRow } from './rows';

export interface IntentionRecord {
  id: string;
  month: Month;
  setAsideAmount: number;
  wantsLimit?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReflectionNotes {
  improveNote?: string;
  needsNote?: string;
  wantsNote?: string;
  growthNote?: string;
  unexpectedNote?: string;
  overallNote?: string;
}

export interface ReflectionRecord extends ReflectionNotes {
  id: string;
  month: Month;
  /** The numbers as they were when the reflection was saved (PRD REF-6). */
  summarySnapshotJson: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function numbers<T>(row: Row, keys: readonly string[]): T {
  const record = fromRow<Record<string, string | number>>(row);
  for (const key of keys) if (key in record) record[key] = Number(record[key]);
  return record as unknown as T;
}

export async function loadIntentions(driver: SqlDriver): Promise<IntentionRecord[]> {
  const rows = await driver.all('SELECT * FROM monthly_intentions ORDER BY month DESC');
  return rows.map((row) => numbers<IntentionRecord>(row, ['setAsideAmount', 'wantsLimit']));
}

export async function loadReflections(driver: SqlDriver): Promise<ReflectionRecord[]> {
  return (await driver.all('SELECT * FROM reflections ORDER BY month DESC')).map((row) => fromRow<ReflectionRecord>(row));
}

/** One intention per month: setting it again replaces the earlier one. */
export async function saveIntentionRecord(driver: SqlDriver, record: IntentionRecord): Promise<void> {
  const existing = await driver.all<{ id: string }>('SELECT id FROM monthly_intentions WHERE month = ?', [record.month]);
  if (existing.length === 0) return insertRow(driver, 'monthly_intentions', record);
  const patch = { setAsideAmount: record.setAsideAmount, wantsLimit: record.wantsLimit, note: record.note, updatedAt: record.updatedAt };
  await driver.run('UPDATE monthly_intentions SET wants_limit = NULL, note = NULL WHERE id = ?', [existing[0]!.id]);
  await updateRow(driver, 'monthly_intentions', existing[0]!.id, patch);
}

export async function insertReflection(driver: SqlDriver, record: ReflectionRecord): Promise<void> {
  await insertRow(driver, 'reflections', record);
}
