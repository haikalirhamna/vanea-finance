/** Salary advance: money taken early from the Pool, repaid from the next salaries (PRD ADV-*, USER-FLOWS §11). */
import { maxDebitAllowed } from '@/domain/ledger';
import { AdvanceErrorCode, installmentFor, validateEarlyRepayment, validateNewAdvance } from '@/domain/salary-advance';
import { firstUnpaidPeriod } from '@/domain/salary-change';
import { insertAdvance, updateAdvance } from '@/data/salary';
import { loadSnapshot } from '@/data/snapshot';
import { formatMoney } from '@/lib/format';
import { ActionContext, ActionResult, failure, runAtomic, writeBatch } from '../action-runtime';
import { ExplainedError, problem } from '../errors';
import { activeAdvanceOf, salaryState } from './salary-state';

const REFUSALS: Record<AdvanceErrorCode, (max?: number, outstanding?: number) => ExplainedError> = {
  INVALID_AMOUNT: () => problem('Check the amount', 'The amount has to be a whole number of rupiah above zero.', 'Enter the amount again.'),
  INVALID_TERM: () => problem('Choose 1 to 6 salaries', 'An advance is repaid over 1 to 6 salaries.', 'Pick a number from 1 to 6.'),
  ADVANCE_ALREADY_ACTIVE: (_max, outstanding) => problem(
    'You already have an advance', 'Only one advance can run at a time.', `Repay your current advance first (${formatMoney(outstanding ?? 0)} left).`,
  ),
  ABOVE_SALARY: (max) => problem('That is more than your salary', `An advance can be at most one salary: ${formatMoney(max ?? 0)}.`, 'Enter a smaller amount.'),
  ABOVE_POOL: (max) => problem('Your Pool cannot give that much', `Your Pool can give ${formatMoney(max ?? 0)} right now.`, 'Enter a smaller amount.'),
  ABOVE_OUTSTANDING: (max) => problem("That's more than you owe", `You still owe ${formatMoney(max ?? 0)} on this advance.`, `Repay up to ${formatMoney(max ?? 0)}.`),
};

/** Pool decreases, Available Spending increases; the next salaries are lower by the installment. */
export async function createAdvance(ctx: ActionContext, input: { amount: number; termPeriods: number }): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const snapshot = await loadSnapshot(ctx.driver);
    const state = salaryState(snapshot, ctx.today());
    const verdict = validateNewAdvance({
      amount: input.amount, termPeriods: input.termPeriods, salary: state.salary ?? 0,
      poolMax: maxDebitAllowed(snapshot.transactions, 'pool', ctx.today()), hasActiveAdvance: state.advance !== null,
    });
    if (!verdict.ok) return failure(REFUSALS[verdict.code](verdict.max, state.advance?.outstanding));
    const id = ctx.newId();
    const firstPeriod = firstUnpaidPeriod(snapshot.transactions, ctx.today(), snapshot.profile!.paydayDay);
    await insertAdvance(ctx.driver, {
      id, amount: input.amount, termPeriods: input.termPeriods, installmentAmount: installmentFor(input.amount, input.termPeriods),
      firstPeriod, origin: 'manual', status: 'active',
    }, ctx.now());
    return writeBatch(ctx, [{ id: ctx.newId(), kind: 'advance_disbursement', date: ctx.today(), amount: input.amount, advanceId: id }]);
  });
}

/** Pays part or all of what is owed now: same installment, so the advance finishes sooner. */
export async function repayAdvanceEarly(ctx: ActionContext, input: { amount: number }): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const snapshot = await loadSnapshot(ctx.driver);
    const advance = activeAdvanceOf(snapshot.advances, snapshot.transactions);
    if (!advance) return failure(problem('No advance to repay', 'You have no active salary advance.', 'Nothing to do here.'));
    const verdict = validateEarlyRepayment(input.amount, advance.outstanding);
    if (!verdict.ok) return failure(REFUSALS[verdict.code](verdict.max));
    return writeBatch(ctx, [{
      id: ctx.newId(), kind: 'advance_early_repayment', date: ctx.today(), amount: input.amount, advanceId: advance.record.id,
    }], async () => {
      if (input.amount === advance.outstanding) await updateAdvance(ctx.driver, advance.record.id, { status: 'repaid' }, ctx.now());
    });
  });
}

