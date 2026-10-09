/** Investments by holding: put in, dated estimates, realized gains, allocation (SYSTEM-OVERVIEW §6.11). */
import { DateString, daysBetween } from './calendar';
import { CONFIG } from './config';
import { Transaction, scopedBalance } from './ledger';
import { Rupiah } from './money';

export type AssetClass =
  | 'time_deposit' | 'government_bond' | 'money_market_fund' | 'fixed_income_fund' | 'mixed_fund'
  | 'gold' | 'equity_fund' | 'stock' | 'crypto_digital' | 'other';

export type RiskLevel = 'low' | 'low_medium' | 'medium' | 'high' | 'very_high';

/** The general risk of an asset class: a label for the class, never advice about a holding. */
export const ASSET_CLASS_RISK: Record<Exclude<AssetClass, 'other'>, RiskLevel> = {
  time_deposit: 'low',
  government_bond: 'low',
  money_market_fund: 'low',
  fixed_income_fund: 'low_medium',
  mixed_fund: 'medium',
  gold: 'medium',
  equity_fund: 'high',
  stock: 'high',
  crypto_digital: 'very_high',
};

export interface Holding {
  id: string;
  assetClass: AssetClass;
  /** Only for `other`: the user's own label. */
  riskOverride?: RiskLevel;
}

/** The user's estimate of a holding's value on a date. It never moves money. */
export interface Valuation {
  value: Rupiah;
  asOf: DateString;
}

export interface SalePlan {
  costRemoved: Rupiah;
  /** Proceeds minus cost removed; negative is a loss. */
  realizedGain: number;
}

export interface Allocation {
  assetClass: AssetClass;
  putIn: Rupiah;
  /** Share of total put in, 0–1. */
  share: number;
  risk: RiskLevel | null;
}

export interface InvestmentTotals {
  putIn: Rupiah;
  /** Sum of the latest estimates; null when no holding has one. */
  estimatedValue: Rupiah | null;
  /** Holdings that have money in but no estimate yet. */
  holdingsWithoutEstimate: number;
  oldestEstimate: DateString | null;
  /** Estimate minus put in, over the holdings that have an estimate; null without estimates. */
  onPaper: number | null;
}

export function riskOf(holding: Pick<Holding, 'assetClass' | 'riskOverride'>): RiskLevel | null {
  if (holding.assetClass === 'other') return holding.riskOverride ?? null;
  return ASSET_CLASS_RISK[holding.assetClass];
}

export function isHighRisk(risk: RiskLevel | null): boolean {
  return risk === 'high' || risk === 'very_high';
}

/** Money actually contributed, minus the cost of anything sold. Certain. */
export function putInOf(transactions: readonly Transaction[], holdingId: string): Rupiah {
  return scopedBalance(transactions, 'investment', holdingId);
}

/** Cash income (dividends, coupons, interest) kept with the holding. */
export function cashOf(transactions: readonly Transaction[], holdingId: string): Rupiah {
  return scopedBalance(transactions, 'investment_cash', holdingId);
}

export function latestValuation(valuations: readonly Valuation[]): Valuation | null {
  if (valuations.length === 0) return null;
  return valuations.reduce((best, v) => (v.asOf >= best.asOf ? v : best));
}

/** An estimate older than 90 days is flagged, never hidden. */
export function isStale(valuation: Valuation, today: DateString): boolean {
  return daysBetween(valuation.asOf, today) > CONFIG.INVESTMENT_STALE_DAYS;
}

/** Estimated value minus put in. A neutral number, not a gain the user has. */
export function onPaper(estimatedValue: Rupiah, putIn: Rupiah): number {
  return estimatedValue - putIn;
}

/** The cost removed by a sale (all of the put in, or a share of it) and the realized gain or loss. */
export function planSale(input: { putIn: Rupiah; proceeds: Rupiah; share: number | 'all' }): SalePlan {
  const costRemoved = input.share === 'all' ? input.putIn : Math.round(input.putIn * input.share);
  return { costRemoved, realizedGain: input.proceeds - costRemoved };
}

/** Put in by asset class, largest first, with each class's share of the total. */
export function allocationOf(holdings: readonly { holding: Holding; putIn: Rupiah }[]): Allocation[] {
  const total = holdings.reduce((sum, h) => sum + h.putIn, 0);
  const byClass = new Map<AssetClass, { putIn: Rupiah; holding: Holding }>();
  for (const { holding, putIn } of holdings) {
    const current = byClass.get(holding.assetClass);
    byClass.set(holding.assetClass, { holding: current?.holding ?? holding, putIn: (current?.putIn ?? 0) + putIn });
  }
  return [...byClass.entries()]
    .map(([assetClass, { putIn, holding }]) => ({ assetClass, putIn, share: total > 0 ? putIn / total : 0, risk: riskOf(holding) }))
    .sort((a, b) => b.putIn - a.putIn);
}

/** The asset class that holds more than half of what was put in and is high or very high risk, if any. */
export function concentratedClass(allocation: readonly Allocation[]): Allocation | null {
  return allocation.find((a) => a.share > CONFIG.CONCENTRATION_SHARE && isHighRisk(a.risk)) ?? null;
}

/** Totals for the Investments view: put in is the main number, the estimate is secondary. */
export function investmentTotals(
  holdings: readonly { putIn: Rupiah; valuations: readonly Valuation[] }[],
): InvestmentTotals {
  const withEstimate = holdings.flatMap((h) => {
    const latest = latestValuation(h.valuations);
    return latest ? [{ putIn: h.putIn, latest }] : [];
  });
  const estimated = withEstimate.reduce((sum, h) => sum + h.latest.value, 0);
  const putInWithEstimate = withEstimate.reduce((sum, h) => sum + h.putIn, 0);
  return {
    putIn: holdings.reduce((sum, h) => sum + h.putIn, 0),
    estimatedValue: withEstimate.length > 0 ? estimated : null,
    holdingsWithoutEstimate: holdings.filter((h) => h.putIn > 0 && h.valuations.length === 0).length,
    oldestEstimate: withEstimate.length > 0 ? withEstimate.map((h) => h.latest.asOf).sort()[0]! : null,
    onPaper: withEstimate.length > 0 ? estimated - putInWithEstimate : null,
  };
}
