/** What the subscription screens show. Pure. */
import { DateString, Month } from '@/domain/calendar';
import { runwayMonths } from '@/domain/pool';
import { PriceImpact, monthlyEquivalent, monthlyEquivalents, priceAt, priceChangeImpact, priceChangeSince } from '@/domain/subscriptions';
import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { Snapshot } from '@/data/snapshot';
import { poolSummary } from '../dashboard/dashboard-summary';
import { salaryState } from '../salary/salary-state';

export interface SubscriptionRow {
  id: string;
  name: string;
  cycle: 'monthly' | 'yearly';
  price: number | null;
  monthly: number;
  nextBillingDate: DateString;
  dueToday: boolean;
  /** "+12% since Jan 2026" */
  change: { percent: number; sinceMonth: Month } | null;
  /** An announced price that has not started yet. */
  upcoming: { price: number; effectiveFrom: DateString } | null;
}

export interface SubscriptionList {
  rows: SubscriptionRow[];
  monthlyTotal: number;
}

export function subscriptionList(snapshot: Snapshot, today: DateString): SubscriptionList {
  const rows = snapshot.subscriptions.map((s): SubscriptionRow => {
    const price = priceAt(s.prices, today);
    const next = [...s.prices].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1)).find((p) => p.effectiveFrom > today);
    return {
      id: s.id, name: s.name, cycle: s.cycle, price, monthly: price === null ? 0 : monthlyEquivalent(s.cycle, price),
      nextBillingDate: s.nextBillingDate, dueToday: s.nextBillingDate <= today,
      change: priceChangeSince(s.prices, today), upcoming: next ? { price: next.price, effectiveFrom: next.effectiveFrom } : null,
    };
  });
  return { rows, monthlyTotal: monthlyEquivalents(snapshot.subscriptions, today).reduce((a, b) => a + b, 0) };
}

/** "Your monthly commitments rise by Rp 25.000 …": the impact of a price change (USER-FLOWS §4.3). */
export function previewPriceChange(snapshot: Snapshot, today: DateString, id: string, newPrice: number): PriceImpact | null {
  const subscription = snapshot.subscriptions.find((s) => s.id === id);
  if (!subscription) return null;
  const salary = salaryState(snapshot, today).salary;
  const pool = poolSummary(snapshot, today, salary, balanceOf(allMovements(snapshot.transactions), 'pool'));
  const current = priceAt(subscription.prices, today) ?? 0;
  const impact = priceChangeImpact({
    oldMonthly: monthlyEquivalent(subscription.cycle, current), newMonthly: monthlyEquivalent(subscription.cycle, newPrice),
    commitment: pool.commitment, ownPool: pool.own,
  });
  return { ...impact, runwayBefore: runwayMonths(pool.own, pool.commitment) };
}
