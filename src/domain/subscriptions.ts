/** Subscriptions: price history, monthly equivalent, yearly cost spreading, price changes (SYSTEM-OVERVIEW §6.8). */
import { DateString, Month, addMonths, addMonthsToDate, dayOfMonth } from './calendar';
import { CONFIG } from './config';
import { BillingCycle } from './ledger-types';
import { Rupiah } from './money';
import { runwayMonths } from './pool';

export interface SubscriptionPrice {
  price: Rupiah;
  /** May be in the future: an announced change. */
  effectiveFrom: DateString;
}

/** The part of a cost that belongs to one month. */
export interface CostShare {
  month: Month;
  amount: Rupiah;
}

export type PriceChoice = 'from_now_on' | 'only_this_time';

export interface PriceImpact {
  /** Change in the monthly equivalent (negative for a decrease). */
  monthlyDelta: Rupiah;
  commitmentBefore: Rupiah;
  commitmentAfter: Rupiah;
  runwayBefore: number | null;
  runwayAfter: number | null;
}

/** The price in effect on a date: the latest price row effective on or before it. */
export function priceAt(prices: readonly SubscriptionPrice[], date: DateString): Rupiah | null {
  const applicable = prices.filter((p) => p.effectiveFrom <= date);
  if (applicable.length === 0) return null;
  return applicable.reduce((best, p) => (p.effectiveFrom >= best.effectiveFrom ? p : best)).price;
}

export interface Subscription {
  cycle: BillingCycle;
  prices: readonly SubscriptionPrice[];
}

/** What a subscription adds to the monthly commitments: yearly prices are divided by 12, rounded down. */
export function monthlyEquivalent(cycle: BillingCycle, price: Rupiah): Rupiah {
  return cycle === 'yearly' ? Math.floor(price / CONFIG.YEARLY_SPREAD_MONTHS) : price;
}

/**
 * How a charge belongs to months. Monthly: all in the month paid. Yearly: 12 equal
 * shares starting with the month paid; the rounding remainder goes to the first month,
 * so the shares add up exactly to the amount.
 */
export function spreadCharge(amount: Rupiah, cycle: BillingCycle, paidMonth: Month): CostShare[] {
  if (cycle === 'monthly') return [{ month: paidMonth, amount }];
  const months = CONFIG.YEARLY_SPREAD_MONTHS;
  const share = Math.floor(amount / months);
  return Array.from({ length: months }, (_, offset) => ({
    month: addMonths(paidMonth, offset),
    amount: offset === 0 ? amount - share * (months - 1) : share,
  }));
}

/** The next billing date: one cycle later, keeping the original day of month. */
export function nextBillingDate(current: DateString, cycle: BillingCycle, anchorDay: number = dayOfMonth(current)): DateString {
  return addMonthsToDate(current, cycle === 'yearly' ? 12 : 1, anchorDay);
}

/** Whether the amount entered at a billing differs from the saved price, so the user must be asked. */
export function needsPriceQuestion(expected: Rupiah | null, entered: Rupiah): boolean {
  return expected !== null && entered !== expected;
}

/**
 * Applies the user's answer to "Did the price change?".
 * "From now on" adds (or replaces) a price row effective from the billing date; "only this time" changes nothing.
 */
export function applyPriceChoice(
  prices: readonly SubscriptionPrice[],
  billingDate: DateString,
  entered: Rupiah,
  choice: PriceChoice,
): SubscriptionPrice[] {
  if (choice === 'only_this_time') return [...prices];
  const others = prices.filter((p) => p.effectiveFrom !== billingDate);
  return [...others, { price: entered, effectiveFrom: billingDate }].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

/** The calm impact of a price change on the monthly commitments and the runway. */
export function priceChangeImpact(input: {
  oldMonthly: Rupiah;
  newMonthly: Rupiah;
  commitment: Rupiah;
  ownPool: Rupiah;
}): PriceImpact {
  const monthlyDelta = input.newMonthly - input.oldMonthly;
  const commitmentAfter = input.commitment + monthlyDelta;
  return {
    monthlyDelta,
    commitmentBefore: input.commitment,
    commitmentAfter,
    runwayBefore: runwayMonths(input.ownPool, input.commitment),
    runwayAfter: runwayMonths(input.ownPool, commitmentAfter),
  };
}

/** "+12% since Jan 2026": the first price against today's, or null when the price never changed. */
export function priceChangeSince(
  prices: readonly SubscriptionPrice[],
  today: DateString,
): { percent: number; sinceMonth: Month } | null {
  const ordered = [...prices].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  const first = ordered[0];
  const current = priceAt(prices, today);
  if (!first || current === null || current === first.price) return null;
  return {
    percent: Math.round(((current - first.price) / first.price) * 100),
    sinceMonth: first.effectiveFrom.slice(0, 7),
  };
}

/** The monthly equivalent of every subscription at its price on `date` (subscriptions with no price yet are left out). */
export function monthlyEquivalents(subscriptions: readonly Subscription[], date: DateString): Rupiah[] {
  return subscriptions.flatMap((subscription) => {
    const price = priceAt(subscription.prices, date);
    return price === null ? [] : [monthlyEquivalent(subscription.cycle, price)];
  });
}
