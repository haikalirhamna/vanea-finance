/** Paying yourself: full, partial or top-up payments, with any advance installment withheld (PRD SAL-2). */
import { Month } from '@/domain/calendar';
import { allMovements } from '@/domain/ledger-movements';
import { balanceOf } from '@/domain/ledger';
import { planPayment } from '@/domain/salary-payment';
import { loadSnapshot } from '@/data/snapshot';
import { updateAdvance } from '@/data/salary';
import { formatMoney } from '@/lib/format';
import { ActionContext, ActionResult, failure, runAtomic, success, writeBatch } from '../action-runtime';
import { ExplainedError, problem } from '../errors';
import { SalaryState, salaryState } from './salary-state';

export interface PaidSalary {
  period: Month;
  paid: number;
  /** What was withheld to repay a salary advance. */
  installment: number;
}

type PaymentRefusal = { code: 'INVALID_AMOUNT' | 'EXCEEDS_ENTITLEMENT' | 'EXCEEDS_POOL'; max: number };

function explainRefusal(refusal: PaymentRefusal, requested: number, pool: number): ExplainedError {
  if (refusal.code === 'EXCEEDS_POOL') {
    return problem(
      'Not enough in your Pool',
      `You want to pay yourself ${formatMoney(requested)}, but your Pool has ${formatMoney(pool)}.`,
      `You can pay ${formatMoney(refusal.max)} now and the rest later this period if more income arrives.`,
    );
  }
  if (refusal.code === 'EXCEEDS_ENTITLEMENT') {
    return problem("That's more than this period's salary", `Only ${formatMoney(refusal.max)} of this period's salary is left to pay.`, `Pay up to ${formatMoney(refusal.max)}.`);
  }
  return problem('Check the amount', 'The amount has to be a whole number of rupiah above zero.', 'Enter the amount again.');
}

function noSalaryDue(state: SalaryState): ActionResult<never> | null {
  if (state.payment === null) {
    return failure(problem('No salary to pay yet', 'Your first salary period has not started.', 'Come back on your payday.'));
  }
  if (state.payment.remaining <= 0 && state.payment.hasPayment) {
    return failure(problem('This period is fully paid', 'You already paid the whole salary for this period.', 'Your next salary is due on your next payday.'));
  }
  return null;
}

/**
 * Pays this period's salary from the Pool to Available Spending. The first payment of a period withholds
 * the advance installment, if there is one. Vanea only records: the user moves the real money.
 */
export async function paySalary(ctx: ActionContext, input: { amount: number }): Promise<ActionResult<PaidSalary>> {
  return runAtomic(ctx, async () => {
    const snapshot = await loadSnapshot(ctx.driver);
    const state = salaryState(snapshot, ctx.today());
    const unavailable = noSalaryDue(state);
    if (unavailable) return unavailable;
    const payment = state.payment!;
    const pool = balanceOf(allMovements(snapshot.transactions), 'pool');
    const plan = planPayment(payment, pool, input.amount);
    if (!plan.ok) return failure(explainRefusal(plan, input.amount, pool));

    const advanceId = plan.installment > 0 ? state.advance?.record.id : undefined;
    const written = await writeBatch(ctx, [{
      id: ctx.newId(), kind: 'salary_payment', date: ctx.today(), amount: input.amount, salaryPeriod: state.period,
      advanceInstallment: plan.installment, ...(advanceId ? { advanceId } : {}),
    }], async () => {
      if (advanceId && state.advance!.outstanding - plan.installment <= 0) {
        await updateAdvance(ctx.driver, advanceId, { status: 'repaid' }, ctx.now());
      }
    });
    return written.ok ? success({ period: state.period, paid: input.amount, installment: plan.installment }) : written;
  });
}
