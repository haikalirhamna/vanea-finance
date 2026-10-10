/** Salary decisions: the monthly review, raises, decreases and restoring (PRD SAL-4..7). Vanea never changes salary by itself. */
import { monthOf } from '@/domain/calendar';
import { SalaryChangeErrorCode, SalaryChangeType, restoreCeiling, salaryFor, validateSalaryChange } from '@/domain/salary-change';
import { insertSalarySetting } from '@/data/salary';
import { decideEvaluation, expireBefore, insertEvaluation, recordOf } from '@/data/salary-evaluations';
import { loadSnapshot } from '@/data/snapshot';
import { formatMoney } from '@/lib/format';
import { ActionContext, ActionResult, failure, runAtomic, success } from '../action-runtime';
import { ExplainedError, problem } from '../errors';
import { evaluateToday, reviewForMonth, salaryOptions } from './salary-review';

/**
 * On the first open of a month: close reviews nobody acted on and take this month's snapshot.
 * Until it is decided, the snapshot follows corrections to past months.
 */
export async function ensureMonthlyReview(ctx: ActionContext): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const snapshot = await loadSnapshot(ctx.driver);
    if (!snapshot.profile) return success(undefined);
    const month = monthOf(ctx.today());
    await expireBefore(ctx.driver, month, ctx.now());
    const evaluation = evaluateToday(snapshot, ctx.today());
    if (!evaluation) return success(undefined);
    const existing = reviewForMonth(snapshot, month);
    if (existing && existing.decision !== 'none') return success(undefined);
    if (existing) await ctx.driver.run('DELETE FROM salary_evaluations WHERE id = ?', [existing.id]);
    await insertEvaluation(ctx.driver, recordOf(existing?.id ?? ctx.newId(), month, evaluation, existing?.createdAt ?? ctx.now()));
    return success(undefined);
  });
}

const REFUSALS: Record<SalaryChangeErrorCode, (max?: number) => ExplainedError> = {
  INVALID_AMOUNT: () => problem('Check the amount', 'A salary is a whole number of rupiah above zero.', 'Enter the amount again.'),
  ALREADY_HAS_SALARY: () => problem('You already have a salary', 'The first salary is set once.', 'Use Change salary instead.'),
  CALIBRATION_ENDED: () => problem('Free adjustment is over', 'The first months allow free changes; that window has closed.', 'Wait for the monthly review.'),
  NOT_ELIGIBLE: () => problem('No raise is available', 'There is no open review that allows a raise this month.', 'Check the Salary screen next month.'),
  ABOVE_MAX_RAISE: (max) => problem('That is above the limit', `A raise can be at most ${formatMoney(max ?? 0)} right now.`, 'Choose that amount or a smaller one.'),
  NOT_AN_INCREASE: () => problem('That is not a raise', 'The new salary has to be above your current one.', 'Enter a higher amount.'),
  NOT_A_DECREASE: () => problem('That is not a decrease', 'The new salary has to be below your current one.', 'Enter a lower amount.'),
  ABOVE_RESTORE_CEILING: (max) => problem(
    "That's above what you can restore", `You can return to ${formatMoney(max ?? 0)}, the highest salary of the last 12 months.`, 'Choose that amount or less.',
  ),
};

interface Change {
  type: Extract<SalaryChangeType, 'increase' | 'decrease' | 'restore'>;
  amount: number;
}

/** Validates and records a change that applies to the first unpaid period. */
async function applyChange(ctx: ActionContext, change: Change): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const snapshot = await loadSnapshot(ctx.driver);
    const options = salaryOptions(snapshot, ctx.today());
    const review = change.type === 'increase' ? options.review : null;
    const verdict = validateSalaryChange({
      changeType: change.type, newAmount: change.amount, currentSalary: salaryFor(snapshot.salarySettings, options.period), period: options.period,
      calibrationUntil: snapshot.profile!.calibrationUntilPeriod,
      ...(review ? { review: { status: review.status, ...(review.maxNewSalary === undefined ? {} : { maxNewSalary: review.maxNewSalary }), decision: review.decision } } : {}),
      restoreCeiling: restoreCeiling(snapshot.salarySettings, options.period),
    });
    if (!verdict.ok) return failure(REFUSALS[verdict.code](verdict.max));
    await insertSalarySetting(ctx.driver, {
      id: ctx.newId(), amount: change.amount, effectivePeriod: options.period, changeType: change.type,
      ...(review ? { evaluationId: review.id } : {}), createdAt: ctx.now(),
    });
    if (review) {
      const decision = change.amount === review.maxNewSalary ? 'accepted' : 'accepted_smaller';
      await decideEvaluation(ctx.driver, review.id, decision, change.amount, ctx.now());
    }
    return success(undefined);
  });
}

/** Accept a raise: the maximum, or any smaller amount above the current salary. */
export const acceptRaise = (ctx: ActionContext, input: { amount: number }): Promise<ActionResult> =>
  applyChange(ctx, { type: 'increase', amount: input.amount });

export const decreaseSalary = (ctx: ActionContext, input: { amount: number }): Promise<ActionResult> =>
  applyChange(ctx, { type: 'decrease', amount: input.amount });

export const restoreSalary = (ctx: ActionContext, input: { amount: number }): Promise<ActionResult> =>
  applyChange(ctx, { type: 'restore', amount: input.amount });

/** Keep the current salary: nothing changes, next month is evaluated again. */
export async function declineRaise(ctx: ActionContext): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const options = salaryOptions(await loadSnapshot(ctx.driver), ctx.today());
    if (!options.review) return failure(REFUSALS.NOT_ELIGIBLE());
    await decideEvaluation(ctx.driver, options.review.id, 'declined', undefined, ctx.now());
    return success(undefined);
  });
}
