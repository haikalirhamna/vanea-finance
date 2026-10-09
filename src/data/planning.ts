/** Historical income months, monthly intentions and reflections (SCHEMA §3.2, §3.8, §3.10). */
import { HistoricalMonth } from '@/domain/income-history';
import { SqlDriver } from './driver';
import { insertRow } from './rows';

export async function loadHistoricalMonths(driver: SqlDriver): Promise<HistoricalMonth[]> {
  const rows = await driver.all<{ month: string; amount: number }>('SELECT month, amount FROM historical_income_months ORDER BY month');
  return rows.map((row) => ({ month: row.month, amount: Number(row.amount) }));
}

/** Replaces the whole history: it is evidence the user can redo. Call inside `driver.transaction`. */
export async function replaceHistoricalMonths(driver: SqlDriver, months: readonly HistoricalMonth[], now: string): Promise<void> {
  await driver.run('DELETE FROM historical_income_months');
  for (const entry of months) {
    await insertRow(driver, 'historical_income_months', {
      id: `history:${entry.month}`, month: entry.month, amount: entry.amount, createdAt: now, updatedAt: now,
    });
  }
}
