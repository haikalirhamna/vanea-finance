/** Holdings and their dated estimates (SCHEMA §3.8). An estimate never moves money. */
import { AssetClass, RiskLevel, Valuation } from '@/domain/investments';
import { SqlDriver } from './driver';
import { insertRow, updateRow } from './rows';

export interface HoldingRecord {
  id: string;
  name: string;
  assetClass: AssetClass;
  riskOverride?: RiskLevel;
  platform?: string;
  status: 'open' | 'closed';
  note?: string;
  valuations: Valuation[];
}

interface HoldingRow {
  id: string; name: string; asset_class: AssetClass; risk_override: RiskLevel | null; platform: string | null;
  status: 'open' | 'closed'; note: string | null;
}
interface ValuationRow { holding_id: string; value: number; as_of: string }

export async function loadHoldings(driver: SqlDriver): Promise<HoldingRecord[]> {
  const holdings = await driver.all<HoldingRow>('SELECT * FROM holdings ORDER BY created_at, rowid');
  const valuations = await driver.all<ValuationRow>('SELECT * FROM holding_valuations ORDER BY as_of');
  return holdings.map((row): HoldingRecord => ({
    id: row.id, name: row.name, assetClass: row.asset_class, status: row.status,
    ...(row.risk_override ? { riskOverride: row.risk_override } : {}),
    ...(row.platform ? { platform: row.platform } : {}),
    ...(row.note ? { note: row.note } : {}),
    valuations: valuations.filter((v) => v.holding_id === row.id).map((v) => ({ value: Number(v.value), asOf: v.as_of })),
  }));
}

export async function insertHolding(driver: SqlDriver, holding: Omit<HoldingRecord, 'valuations'>, now: string): Promise<void> {
  await insertRow(driver, 'holdings', { ...holding, createdAt: now, updatedAt: now });
}

export async function updateHolding(
  driver: SqlDriver, id: string, patch: Partial<Pick<HoldingRecord, 'name' | 'platform' | 'status' | 'note'>>, now: string,
): Promise<void> {
  await updateRow(driver, 'holdings', id, { ...patch, updatedAt: now });
}

/** One estimate per holding and date: a second one for the same date replaces the first. */
export async function saveValuation(driver: SqlDriver, id: string, holdingId: string, valuation: Valuation, now: string): Promise<void> {
  await driver.run('DELETE FROM holding_valuations WHERE holding_id = ? AND as_of = ?', [holdingId, valuation.asOf]);
  await insertRow(driver, 'holding_valuations', { id, holdingId, value: valuation.value, asOf: valuation.asOf, createdAt: now });
}
