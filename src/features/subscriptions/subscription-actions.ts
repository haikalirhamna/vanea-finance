/** Subscriptions: add, edit, delete, announced price changes, billing and skipping (PRD SUB-*, USER-FLOWS §4). */
import { DateString } from '@/domain/calendar';
import { BillingCycle } from '@/domain/ledger-types';
import { PriceChoice, applyPriceChoice, needsPriceQuestion, nextBillingDate, priceAt } from '@/domain/subscriptions';
import { deleteSubscription, insertSubscription, updateSubscription } from '@/data/subscriptions';
import { loadSnapshot } from '@/data/snapshot';
import { formatMoney } from '@/lib/format';
import { ActionContext, ActionResult, failure, runAtomic, success, writeBatch } from '../action-runtime';
import { problem } from '../errors';

export interface SubscriptionInput {
  name: string;
  cycle: BillingCycle;
  price: number;
  nextBillingDate: DateString;
  note?: string;
}

const gone = () => failure(problem('That subscription is gone', 'It no longer exists.', 'Go back and refresh the list.'));

function invalid(input: Pick<SubscriptionInput, 'name' | 'price'>): ActionResult | null {
  if (!input.name.trim()) return failure(problem('Give it a name', 'A subscription needs a name so you can tell it apart.', 'Enter a name, such as Figma.'));
  if (!Number.isSafeInteger(input.price) || input.price <= 0) {
    return failure(problem('Check the price', 'The price has to be a whole number of rupiah above zero.', 'Enter the price again.'));
  }
  return null;
}

/** Adding is always allowed. The price applies from the day the subscription was added. */
export async function addSubscription(ctx: ActionContext, input: SubscriptionInput): Promise<ActionResult<{ id: string }>> {
  const refused = invalid(input);
  if (refused) return refused as ActionResult<{ id: string }>;
  const id = ctx.newId();
  return runAtomic(ctx, async () => {
    await insertSubscription(ctx.driver, {
      id, name: input.name.trim(), cycle: input.cycle, nextBillingDate: input.nextBillingDate,
      prices: [{ price: input.price, effectiveFrom: ctx.today() }], ...(input.note ? { note: input.note } : {}),
    }, ctx.now());
    return success({ id });
  });
}

export interface SubscriptionEdit {
  name?: string;
  cycle?: BillingCycle;
  nextBillingDate?: DateString;
}

export async function editSubscription(ctx: ActionContext, id: string, changes: SubscriptionEdit): Promise<ActionResult> {
  if (changes.name !== undefined && !changes.name.trim()) return invalid({ name: changes.name, price: 1 })!;
  return runAtomic(ctx, async () => {
    const { subscriptions } = await loadSnapshot(ctx.driver);
    if (!subscriptions.some((s) => s.id === id)) return gone();
    await updateSubscription(ctx.driver, id, { ...changes, ...(changes.name ? { name: changes.name.trim() } : {}) }, ctx.now());
    return success(undefined);
  });
}

/** Deleting always works. Costs already recorded stay in the history with the name they had. */
export async function removeSubscription(ctx: ActionContext, id: string): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const { subscriptions } = await loadSnapshot(ctx.driver);
    if (!subscriptions.some((s) => s.id === id)) return gone();
    await deleteSubscription(ctx.driver, id);
    return success(undefined);
  });
}

/** A price change announced for a date (maybe in the future). Past costs never change. */
export async function announcePriceChange(
  ctx: ActionContext, input: { id: string; price: number; effectiveFrom: DateString },
): Promise<ActionResult> {
  const refused = invalid({ name: 'x', price: input.price });
  if (refused) return refused;
  return runAtomic(ctx, async () => {
    const subscription = (await loadSnapshot(ctx.driver)).subscriptions.find((s) => s.id === input.id);
    if (!subscription) return gone();
    const prices = applyPriceChoice(subscription.prices, input.effectiveFrom, input.price, 'from_now_on');
    await updateSubscription(ctx.driver, input.id, { prices }, ctx.now());
    return success(undefined);
  });
}

const askAboutPrice = (expected: number) => failure(problem(
  'Did the price change?', `You saved ${formatMoney(expected)} for this subscription and entered a different amount.`,
  'Choose whether the new price applies from now on, or only this time.',
));

/**
 * Records a billing the user confirmed (nothing is ever recorded on its own) and moves the next billing date one cycle on.
 * When the amount differs from the saved price, a choice is required.
 */
export async function confirmBilling(
  ctx: ActionContext, input: { id: string; amount: number; choice?: PriceChoice },
): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const subscription = (await loadSnapshot(ctx.driver)).subscriptions.find((s) => s.id === input.id);
    if (!subscription) return gone();
    const billingDate = subscription.nextBillingDate;
    const expected = priceAt(subscription.prices, billingDate);
    if (needsPriceQuestion(expected, input.amount) && !input.choice) return askAboutPrice(expected!);
    const prices = input.choice ? applyPriceChoice(subscription.prices, billingDate, input.amount, input.choice) : subscription.prices;
    return writeBatch(ctx, [{
      id: ctx.newId(), kind: 'business_cost', date: ctx.today(), amount: input.amount, businessCostCategory: 'subscription',
      billingCycle: subscription.cycle, label: subscription.name, subscriptionId: subscription.id,
    }], () => updateSubscription(ctx.driver, subscription.id, {
      prices, nextBillingDate: nextBillingDate(billingDate, subscription.cycle),
    }, ctx.now()));
  });
}

/** Skip this billing: the next date advances, nothing is recorded. */
export async function skipBilling(ctx: ActionContext, id: string): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const subscription = (await loadSnapshot(ctx.driver)).subscriptions.find((s) => s.id === id);
    if (!subscription) return gone();
    await updateSubscription(ctx.driver, id, { nextBillingDate: nextBillingDate(subscription.nextBillingDate, subscription.cycle) }, ctx.now());
    return success(undefined);
  });
}
