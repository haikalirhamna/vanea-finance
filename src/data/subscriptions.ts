/** Subscriptions and their price history (SCHEMA §3.5, §3.11). */
import { BillingCycle } from '@/domain/ledger-types';
import { DateString } from '@/domain/calendar';
import { Subscription, SubscriptionPrice } from '@/domain/subscriptions';
import { SqlDriver } from './driver';
import { insertRow, updateRow } from './rows';

export interface SubscriptionRecord extends Subscription {
  id: string;
  name: string;
  nextBillingDate: DateString;
  note?: string;
}

interface SubscriptionRow { id: string; name: string; billing_cycle: BillingCycle; next_billing_date: string; note: string | null }
interface PriceRow { subscription_id: string; price: number; effective_from: string }

export async function loadSubscriptions(driver: SqlDriver): Promise<SubscriptionRecord[]> {
  const subscriptions = await driver.all<SubscriptionRow>('SELECT * FROM subscriptions ORDER BY name');
  const prices = await driver.all<PriceRow>('SELECT * FROM subscription_prices ORDER BY effective_from');
  return subscriptions.map((row) => ({
    id: row.id,
    name: row.name,
    cycle: row.billing_cycle,
    nextBillingDate: row.next_billing_date,
    ...(row.note ? { note: row.note } : {}),
    prices: prices
      .filter((p) => p.subscription_id === row.id)
      .map((p): SubscriptionPrice => ({ price: Number(p.price), effectiveFrom: p.effective_from })),
  }));
}

async function writePrices(driver: SqlDriver, subscriptionId: string, prices: readonly SubscriptionPrice[], now: string): Promise<void> {
  await driver.run('DELETE FROM subscription_prices WHERE subscription_id = ?', [subscriptionId]);
  for (const [index, price] of prices.entries()) {
    await insertRow(driver, 'subscription_prices', {
      id: `${subscriptionId}:${index}:${price.effectiveFrom}`,
      subscriptionId,
      price: price.price,
      effectiveFrom: price.effectiveFrom,
      createdAt: now,
    });
  }
}

/** Call inside `driver.transaction`. */
export async function insertSubscription(driver: SqlDriver, subscription: SubscriptionRecord, now: string): Promise<void> {
  await insertRow(driver, 'subscriptions', {
    id: subscription.id,
    name: subscription.name,
    billingCycle: subscription.cycle,
    nextBillingDate: subscription.nextBillingDate,
    note: subscription.note,
    createdAt: now,
    updatedAt: now,
  });
  await writePrices(driver, subscription.id, subscription.prices, now);
}

export interface SubscriptionPatch {
  name?: string;
  cycle?: BillingCycle;
  nextBillingDate?: DateString;
  note?: string | null;
  prices?: readonly SubscriptionPrice[];
}

/** Call inside `driver.transaction`. */
export async function updateSubscription(driver: SqlDriver, id: string, patch: SubscriptionPatch, now: string): Promise<void> {
  const { cycle, prices, ...rest } = patch;
  await updateRow(driver, 'subscriptions', id, { ...rest, billingCycle: cycle, updatedAt: now });
  if (prices) await writePrices(driver, id, prices, now);
}

/** Deleting always works. Recorded costs keep their `label`; their `subscription_id` becomes empty. */
export async function deleteSubscription(driver: SqlDriver, id: string): Promise<void> {
  await driver.run('DELETE FROM subscriptions WHERE id = ?', [id]);
}
