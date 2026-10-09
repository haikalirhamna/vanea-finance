/** Salary history and salary advances (SCHEMA §3.6, §3.7). */
import { Month } from '@/domain/calendar';
import { SalaryAdvance } from '@/domain/salary-advance';
import { SalarySetting } from '@/domain/salary-change';
import { SqlDriver, first } from './driver';
import { Row, fromRow, insertRow, updateRow } from './rows';

export interface SalarySettingRecord extends SalarySetting {
  id: string;
  evaluationId?: string;
  recommendedAmount?: number;
  note?: string;
  createdAt: string;
}

export type AdvanceOrigin = 'manual' | 'income_reversal';

export interface AdvanceRecord extends SalaryAdvance {
  origin: AdvanceOrigin;
  originTransactionId?: string;
  status: 'active' | 'repaid';
  note?: string;
}

function numbers<T>(row: Row, keys: readonly string[]): T {
  const record = fromRow<Record<string, string | number>>(row);
  for (const key of keys) if (key in record) record[key] = Number(record[key]);
  return record as unknown as T;
}

/** Salary history, oldest first. */
export async function loadSalarySettings(driver: SqlDriver): Promise<SalarySettingRecord[]> {
  const rows = await driver.all('SELECT * FROM salary_settings ORDER BY effective_period, created_at, rowid');
  return rows.map((row) => numbers<SalarySettingRecord>(row, ['amount', 'recommendedAmount']));
}

export async function insertSalarySetting(driver: SqlDriver, setting: SalarySettingRecord): Promise<void> {
  await insertRow(driver, 'salary_settings', setting);
}

export async function loadAdvances(driver: SqlDriver): Promise<AdvanceRecord[]> {
  const rows = await driver.all('SELECT * FROM salary_advances ORDER BY created_at, rowid');
  return rows.map((row) => numbers<AdvanceRecord>(row, ['amount', 'termPeriods', 'installmentAmount']));
}

export async function insertAdvance(driver: SqlDriver, advance: AdvanceRecord, now: string): Promise<void> {
  await insertRow(driver, 'salary_advances', { ...advance, createdAt: now, updatedAt: now });
}

export type AdvancePatch = Partial<Pick<AdvanceRecord, 'amount' | 'installmentAmount' | 'termPeriods' | 'status'>>;

export async function updateAdvance(driver: SqlDriver, id: string, patch: AdvancePatch, now: string): Promise<void> {
  await updateRow(driver, 'salary_advances', id, { ...patch, updatedAt: now });
}

export async function activeAdvanceId(driver: SqlDriver): Promise<string | null> {
  return (await first<{ id: string }>(driver, "SELECT id FROM salary_advances WHERE status = 'active'"))?.id ?? null;
}

export type { Month };
