/** The Investments view and the net position (USER-FLOWS §23.6). Put in is certain; estimates are dated and secondary. Pure. */
import { DateString } from '@/domain/calendar';
import { totalOwed } from '@/domain/debts';
import {
  Allocation, AssetClass, InvestmentTotals, RiskLevel, allocationOf, cashOf, concentratedClass, investmentTotals, isStale, latestValuation, onPaper, putInOf, riskOf,
} from '@/domain/investments';
import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { Snapshot } from '@/data/snapshot';
import { debtBookOf } from '../dashboard/dashboard-summary';

export interface HoldingRow {
  id: string;
  name: string;
  assetClass: AssetClass;
  platform: string | undefined;
  risk: RiskLevel | null;
  status: 'open' | 'closed';
  putIn: number;
  cash: number;
  estimate: { value: number; asOf: DateString; stale: boolean; onPaper: number } | null;
}

export interface InvestmentsView {
  holdings: HoldingRow[];
  totals: InvestmentTotals;
  allocation: Allocation[];
  concentrated: Allocation | null;
}

export function investmentsView(snapshot: Snapshot, today: DateString): InvestmentsView {
  const rows = snapshot.holdings.map((h): HoldingRow => {
    const putIn = putInOf(snapshot.transactions, h.id);
    const latest = latestValuation(h.valuations);
    return {
      id: h.id, name: h.name, assetClass: h.assetClass, platform: h.platform, risk: riskOf(h), status: h.status, putIn,
      cash: cashOf(snapshot.transactions, h.id),
      estimate: latest ? { value: latest.value, asOf: latest.asOf, stale: isStale(latest, today), onPaper: onPaper(latest.value, putIn) } : null,
    };
  });
  const open = snapshot.holdings.filter((h) => h.status === 'open');
  const allocation = allocationOf(open.map((h) => ({ holding: h, putIn: putInOf(snapshot.transactions, h.id) })));
  return {
    holdings: rows,
    totals: investmentTotals(open.map((h) => ({ putIn: putInOf(snapshot.transactions, h.id), valuations: h.valuations }))),
    allocation,
    concentrated: concentratedClass(allocation),
  };
}

export interface NetPosition {
  money: { pool: number; personal: number; savings: number; total: number };
  investments: { putIn: number; estimatedValue: number | null };
  debts: number;
}

/** Three separate groups: never one total, so a market estimate never looks like spendable money. */
export function netPosition(snapshot: Snapshot, today: DateString): NetPosition {
  const movements = allMovements(snapshot.transactions);
  const [pool, personal, savings] = (['pool', 'personal', 'savings'] as const).map((a) => balanceOf(movements, a)) as [number, number, number];
  const { totals } = investmentsView(snapshot, today);
  return {
    money: { pool, personal, savings, total: pool + personal + savings },
    investments: { putIn: totals.putIn, estimatedValue: totals.estimatedValue },
    debts: totalOwed(debtBookOf(snapshot)),
  };
}
