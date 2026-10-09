/** Paying yourself: entitlement, partial payments and top-ups (SYSTEM-OVERVIEW §6.3). */
import { Month } from './calendar';
import { Rupiah } from './money';
import { Transaction, activeTransactions } from './ledger';

/** The active advance as seen by the payday screen. */
export interface AdvanceTerms {
  firstPeriod: Month;
  installmentAmount: Rupiah;
  outstanding: Rupiah;
}

export interface PeriodPayment {
  period: Month;
  salary: Rupiah;
  /** Salary withheld to repay an advance in this period. */
  installmentWithheld: Rupiah;
  /** salary − installmentWithheld. What the user can receive this period. */
  entitlement: Rupiah;
  paid: Rupiah;
  remaining: Rupiah;
  hasPayment: boolean;
}

export type PaymentErrorCode = 'INVALID_AMOUNT' | 'EXCEEDS_ENTITLEMENT' | 'EXCEEDS_POOL';

export type PaymentPlan =
  | { ok: true; installment: Rupiah }
  | { ok: false; code: PaymentErrorCode; max: Rupiah };

function paymentsIn(transactions: readonly Transaction[], period: Month): Transaction[] {
  return activeTransactions(transactions).filter((tx) => tx.kind === 'salary_payment' && tx.salaryPeriod === period);
}

/**
 * The installment is fixed by the period's first payment. Before any payment
 * it is what the advance currently asks for; afterwards it is what was withheld.
 */
function installmentFor(payments: readonly Transaction[], period: Month, advance: AdvanceTerms | null): Rupiah {
  if (payments.length > 0) return payments.reduce((total, tx) => total + (tx.advanceInstallment ?? 0), 0);
  if (!advance || period < advance.firstPeriod) return 0;
  return Math.min(advance.installmentAmount, advance.outstanding);
}

export function periodPayment(input: {
  salary: Rupiah;
  period: Month;
  transactions: readonly Transaction[];
  advance: AdvanceTerms | null;
}): PeriodPayment {
  const payments = paymentsIn(input.transactions, input.period);
  const installmentWithheld = installmentFor(payments, input.period, input.advance);
  const entitlement = Math.max(0, input.salary - installmentWithheld);
  const paid = payments.reduce((total, tx) => total + tx.amount, 0);
  return {
    period: input.period,
    salary: input.salary,
    installmentWithheld,
    entitlement,
    paid,
    remaining: Math.max(0, entitlement - paid),
    hasPayment: payments.length > 0,
  };
}

/** The most that can be paid right now: what is left, limited by the Pool. */
export function maxPaymentNow(state: PeriodPayment, pool: Rupiah): Rupiah {
  return Math.min(state.remaining, pool);
}

/** A period whose whole salary is withheld still records its installment with a zero payment. */
function isSettlementOnly(state: PeriodPayment): boolean {
  return !state.hasPayment && state.entitlement === 0 && state.installmentWithheld > 0;
}

/** Checks a requested payment; the installment applies on the period's first payment only. */
export function planPayment(state: PeriodPayment, pool: Rupiah, requested: Rupiah): PaymentPlan {
  const max = maxPaymentNow(state, pool);
  const zeroAllowed = requested === 0 && isSettlementOnly(state);
  if (!Number.isSafeInteger(requested) || requested < 0 || (requested === 0 && !zeroAllowed)) {
    return { ok: false, code: 'INVALID_AMOUNT', max };
  }
  if (requested > state.remaining) return { ok: false, code: 'EXCEEDS_ENTITLEMENT', max };
  if (requested > pool) return { ok: false, code: 'EXCEEDS_POOL', max };
  return { ok: true, installment: state.hasPayment ? 0 : state.installmentWithheld };
}
