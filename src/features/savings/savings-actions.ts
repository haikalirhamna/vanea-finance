/** Savings and Pool surplus (PRD SAV-*, USER-FLOWS §14, §16). Savings never count as spending money. */
import { maxDebitAllowed } from '@/domain/ledger';
import { ActionContext, ActionResult, commitBatch, failure } from '../action-runtime';
import { problem } from '../errors';
import { poolSummary } from '../dashboard/dashboard-summary';
import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { runwayMonths, safeSurplus } from '@/domain/pool';
import { availableSpending } from '@/domain/spending';
import { loadSnapshot } from '@/data/snapshot';
import { formatMoney } from '@/lib/format';
import { salaryState } from '../salary/salary-state';
import { DateString } from '@/domain/calendar';
import { Snapshot } from '@/data/snapshot';

/** Moving money out of Available Spending needs it to be there: only spending itself may go below zero. */
export async function shortOfSpending(ctx: ActionContext, amount: number): Promise<ActionResult | null> {
  const available = availableSpending((await loadSnapshot(ctx.driver)).transactions);
  if (amount <= available) return null;
  return failure(problem(
    "That's more than you have to spend", `Available Spending is ${formatMoney(Math.max(0, available))}.`, 'Enter a smaller amount, or move it from the Pool.',
  ));
}

/** Available Spending → Savings. */
export async function depositSavings(ctx: ActionContext, input: { amount: number }): Promise<ActionResult> {
  const short = await shortOfSpending(ctx, input.amount);
  if (short) return short;
  return commitBatch(ctx, [{ id: ctx.newId(), kind: 'savings_deposit', date: ctx.today(), amount: input.amount }]);
}

/** Savings → Available Spending. */
export function withdrawSavings(ctx: ActionContext, input: { amount: number }): Promise<ActionResult> {
  return commitBatch(ctx, [{ id: ctx.newId(), kind: 'savings_withdrawal', date: ctx.today(), amount: input.amount }]);
}

export type SurplusTarget = { to: 'savings' } | { to: 'investment'; holdingId: string };

export interface SurplusView {
  pool: number;
  /** Pool money above the buffer (PRD, SYSTEM-OVERVIEW §6.6). */
  safe: number;
  /** What the Pool can give out right now at all. */
  movable: number;
  runwayNow: number | null;
  commitment: number;
}

export function surplusView(snapshot: Snapshot, today: DateString): SurplusView {
  const balance = balanceOf(allMovements(snapshot.transactions), 'pool');
  const pool = poolSummary(snapshot, today, salaryState(snapshot, today).salary, balance);
  return {
    pool: balance, commitment: pool.commitment, safe: safeSurplus(pool.own, snapshot.profile!.bufferMonths, pool.commitment),
    movable: maxDebitAllowed(snapshot.transactions, 'pool', today), runwayNow: pool.runwayMonths,
  };
}

/** The runway left after taking `amount` out of the Pool: shown before confirming a move above the safe surplus. */
export function runwayAfterMove(snapshot: Snapshot, today: DateString, amount: number): number | null {
  const view = surplusView(snapshot, today);
  const balance = view.pool - amount;
  const own = Math.max(0, poolSummary(snapshot, today, salaryState(snapshot, today).salary, balance).own);
  return runwayMonths(own, view.commitment);
}

/** Moves money out of the Pool. Allowed above the safe surplus: the screen shows the runway first, Vanea never blocks it. */
export async function allocateSurplus(ctx: ActionContext, input: { amount: number; target: SurplusTarget }): Promise<ActionResult> {
  if (input.target.to === 'investment' && !input.target.holdingId) {
    return failure(problem('Choose a holding', 'Money moved to investments goes to one holding.', 'Pick the holding.'));
  }
  return commitBatch(ctx, [{
    id: ctx.newId(), kind: 'surplus_allocation', date: ctx.today(), amount: input.amount,
    account: input.target.to === 'savings' ? 'savings' : 'investment',
    ...(input.target.to === 'investment' ? { holdingId: input.target.holdingId } : {}),
  }]);
}
