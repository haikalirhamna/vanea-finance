/** Investments by holding (PRD INV-*, USER-FLOWS §23). They are recorded, never counted as spending money or in the Pool. */
import { DateString } from '@/domain/calendar';
import { AssetClass, RiskLevel, planSale, putInOf } from '@/domain/investments';
import { insertHolding, saveValuation, updateHolding } from '@/data/investments';
import { loadSnapshot } from '@/data/snapshot';
import { shortOfSpending } from '../savings/savings-actions';
import { ActionContext, ActionResult, commitBatch, failure, runAtomic, success, writeBatch } from '../action-runtime';
import { problem } from '../errors';

export interface HoldingInput {
  name: string;
  assetClass: AssetClass;
  riskOverride?: RiskLevel;
  platform?: string;
}

const noHolding = () => failure(problem('That holding is gone', 'It no longer exists.', 'Go back and refresh the list.'));

export async function addHolding(ctx: ActionContext, input: HoldingInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return failure(problem('Give it a name', 'A holding needs a name so you can tell it apart.', 'Enter a name, such as Bibit RDPU.'));
  if (input.assetClass === 'other' && !input.riskOverride) {
    return failure(problem('Set a risk label', 'For "other" you choose the risk label yourself.', 'Pick low, medium or high.'));
  }
  const id = ctx.newId();
  return runAtomic(ctx, async () => {
    await insertHolding(ctx.driver, {
      id, name: input.name.trim(), assetClass: input.assetClass, status: 'open',
      ...(input.riskOverride ? { riskOverride: input.riskOverride } : {}), ...(input.platform?.trim() ? { platform: input.platform.trim() } : {}),
    }, ctx.now());
    return success({ id });
  });
}

/** Money put in, from Available Spending or from the Pool's surplus. */
export async function contribute(
  ctx: ActionContext, input: { holdingId: string; amount: number; from: 'personal' | 'pool' },
): Promise<ActionResult> {
  if (input.from === 'personal') {
    const short = await shortOfSpending(ctx, input.amount);
    if (short) return short;
  }
  const common = { id: ctx.newId(), date: ctx.today(), amount: input.amount, holdingId: input.holdingId };
  return commitBatch(ctx, [input.from === 'pool' ? { ...common, kind: 'surplus_allocation', account: 'investment' } : { ...common, kind: 'investment_contribution' }]);
}

/** A dated estimate. It changes no money total, no Pool, no runway and no salary. */
export async function updateValue(
  ctx: ActionContext, input: { holdingId: string; value: number; asOf?: DateString },
): Promise<ActionResult> {
  if (!Number.isSafeInteger(input.value) || input.value < 0) {
    return failure(problem('Check the value', 'The value is a whole number of rupiah, 0 or more.', 'Enter the value again.'));
  }
  const asOf = input.asOf ?? ctx.today();
  if (asOf > ctx.today()) return failure(problem("That date hasn't come yet", 'An estimate is as of today or earlier.', 'Pick today or an earlier date.'));
  return runAtomic(ctx, async () => {
    if (!(await loadSnapshot(ctx.driver)).holdings.some((h) => h.id === input.holdingId)) return noHolding();
    await saveValuation(ctx.driver, ctx.newId(), input.holdingId, { value: input.value, asOf }, ctx.now());
    return success(undefined);
  });
}

export interface SaleInput {
  holdingId: string;
  proceeds: number;
  /** `all`, or the part sold as a share of what was put in (0–1). */
  share: number | 'all';
  to: 'personal' | 'savings';
}

/** What a sale would remove from put in and the gain or loss it realizes, for the preview. */
export function previewSale(putIn: number, input: Pick<SaleInput, 'proceeds' | 'share'>) {
  return planSale({ putIn, proceeds: input.proceeds, share: input.share });
}

export async function sell(ctx: ActionContext, input: SaleInput): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const { holdings, transactions } = await loadSnapshot(ctx.driver);
    const holding = holdings.find((h) => h.id === input.holdingId);
    if (!holding) return noHolding();
    const plan = previewSale(putInOf(transactions, holding.id), input);
    const written = await writeBatch(ctx, [{
      id: ctx.newId(), kind: 'investment_sale', date: ctx.today(), amount: input.proceeds, holdingId: holding.id,
      costRemoved: plan.costRemoved, destinationAccount: input.to, label: holding.name,
    }]);
    if (written.ok && input.share === 'all') await updateHolding(ctx.driver, holding.id, { status: 'closed' }, ctx.now());
    return written;
  });
}

/** Dividends, coupons or interest are kept with the holding, not in Available Spending or the Pool. */
export function addHoldingIncome(ctx: ActionContext, input: { holdingId: string; amount: number }): Promise<ActionResult> {
  return commitBatch(ctx, [{ id: ctx.newId(), kind: 'investment_income', date: ctx.today(), amount: input.amount, holdingId: input.holdingId }]);
}

export function withdrawHoldingCash(
  ctx: ActionContext, input: { holdingId: string; amount: number; to: 'personal' | 'savings' },
): Promise<ActionResult> {
  return commitBatch(ctx, [{
    id: ctx.newId(), kind: 'investment_cash_withdrawal', date: ctx.today(), amount: input.amount, holdingId: input.holdingId, destinationAccount: input.to,
  }]);
}

/** An investment you already owned before using Vanea: it counts as put in without taking money from anywhere. */
export function recordExistingPutIn(ctx: ActionContext, input: { holdingId: string; amount: number }): Promise<ActionResult> {
  return commitBatch(ctx, [{
    id: ctx.newId(), kind: 'opening_balance', date: ctx.today(), amount: input.amount, account: 'investment', holdingId: input.holdingId,
  }]);
}
