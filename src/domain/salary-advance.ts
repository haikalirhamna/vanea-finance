/** Salary advance: money taken early from the Pool and repaid from future salary (SYSTEM-OVERVIEW §6.4, §6.5). */
import { Month } from './calendar';
import { CONFIG } from './config';
import { Rupiah, ceilDivide } from './money';
import { Transaction, activeTransactions } from './ledger';

export interface SalaryAdvance {
  id: string;
  amount: Rupiah;
  termPeriods: number;
  installmentAmount: Rupiah;
  /** The first salary period an installment is withheld from. */
  firstPeriod: Month;
}

export type AdvanceErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_TERM'
  | 'ADVANCE_ALREADY_ACTIVE'
  | 'ABOVE_SALARY'
  | 'ABOVE_POOL'
  | 'ABOVE_OUTSTANDING';

export type AdvanceValidation = { ok: true } | { ok: false; code: AdvanceErrorCode; max?: Rupiah };

export interface NewAdvanceRequest {
  amount: Rupiah;
  termPeriods: number;
  salary: Rupiah;
  /** What the Pool can give out (see ledger.maxDebitAllowed). */
  poolMax: Rupiah;
  hasActiveAdvance: boolean;
}

const OK: AdvanceValidation = { ok: true };
const fail = (code: AdvanceErrorCode, max?: Rupiah): AdvanceValidation =>
  max === undefined ? { ok: false, code } : { ok: false, code, max };

export function installmentFor(amount: Rupiah, termPeriods: number): Rupiah {
  return ceilDivide(amount, termPeriods);
}

function isValidTerm(term: number): boolean {
  return Number.isInteger(term) && term >= CONFIG.ADVANCE_MIN_TERM && term <= CONFIG.ADVANCE_MAX_TERM;
}

export function validateNewAdvance(request: NewAdvanceRequest): AdvanceValidation {
  if (!Number.isSafeInteger(request.amount) || request.amount <= 0) return fail('INVALID_AMOUNT');
  if (!isValidTerm(request.termPeriods)) return fail('INVALID_TERM');
  if (request.hasActiveAdvance) return fail('ADVANCE_ALREADY_ACTIVE');
  if (request.amount > request.salary) return fail('ABOVE_SALARY', request.salary);
  if (request.amount > request.poolMax) return fail('ABOVE_POOL', request.poolMax);
  return OK;
}

/** What is still owed: the amount minus installments withheld and early repayments (non-reversed). */
export function outstandingOf(advance: SalaryAdvance, transactions: readonly Transaction[]): Rupiah {
  const repaid = activeTransactions(transactions)
    .filter((tx) => tx.advanceId === advance.id)
    .reduce((total, tx) => {
      if (tx.kind === 'salary_payment') return total + (tx.advanceInstallment ?? 0);
      if (tx.kind === 'advance_early_repayment') return total + tx.amount;
      return total;
    }, 0);
  return Math.max(0, advance.amount - repaid);
}

export function isRepaid(outstanding: Rupiah): boolean {
  return outstanding <= 0;
}

/** The installment due in a period: the regular installment, or what is left if smaller. */
export function installmentDue(advance: SalaryAdvance, outstanding: Rupiah): Rupiah {
  return Math.min(advance.installmentAmount, outstanding);
}

/** Periods left at the current installment. */
export function periodsRemaining(advance: SalaryAdvance, outstanding: Rupiah): number {
  return outstanding <= 0 ? 0 : ceilDivide(outstanding, advance.installmentAmount);
}

export function validateEarlyRepayment(amount: Rupiah, outstanding: Rupiah): AdvanceValidation {
  if (!Number.isSafeInteger(amount) || amount <= 0) return fail('INVALID_AMOUNT');
  return amount <= outstanding ? OK : fail('ABOVE_OUTSTANDING', outstanding);
}

export interface AdvanceFromReversal {
  amount: Rupiah;
  termPeriods: number;
  installmentAmount: Rupiah;
}

/** A new advance for an income-reversal remainder (default term 3, changeable 1–6). */
export function advanceForRemainder(
  remainder: Rupiah,
  termPeriods: number = CONFIG.ADVANCE_REVERSAL_DEFAULT_TERM,
): AdvanceFromReversal {
  return { amount: remainder, termPeriods, installmentAmount: installmentFor(remainder, termPeriods) };
}

/**
 * Adds a reversal remainder to the active advance. The installment stays the
 * same (the advance runs longer) unless that would exceed the maximum term;
 * then the installment grows to fit.
 */
export function addRemainderToAdvance(
  advance: SalaryAdvance,
  outstanding: Rupiah,
  remainder: Rupiah,
): Pick<SalaryAdvance, 'amount' | 'installmentAmount'> {
  const newOutstanding = outstanding + remainder;
  const fitsMaxTerm = ceilDivide(newOutstanding, CONFIG.ADVANCE_MAX_TERM);
  return {
    amount: advance.amount + remainder,
    installmentAmount: Math.max(advance.installmentAmount, fitsMaxTerm),
  };
}
