/** Installment loans: schedule, cost of borrowing, yearly rate, interest split (SYSTEM-OVERVIEW §6.10). */
import { DateString, Month, addMonthsToDate, dayOfMonth, daysBetween, monthOf } from './calendar';
import { Transaction, activeTransactions, scopedBalance } from './ledger';
import { Rupiah } from './money';

export type LoanPurpose = 'personal' | 'business';
export type LoanFrequency = 'monthly' | 'single';

export interface InstallmentLoan {
  id: string;
  purpose: LoanPurpose;
  received: Rupiah;
  installmentAmount: Rupiah;
  installmentCount: number;
  frequency: LoanFrequency;
  /** The day the money was received (or the item bought). */
  startDate: DateString;
  firstDueDate: DateString;
}

export interface UnpaidInstallment {
  /** 1-based position in the schedule. */
  number: number;
  date: DateString;
  amount: Rupiah;
}

export type LoanTermsError =
  | 'INVALID_AMOUNT'
  | 'INVALID_INSTALLMENT'
  | 'INVALID_COUNT'
  | 'REPAYS_LESS_THAN_RECEIVED'
  | 'SINGLE_NEEDS_ONE_INSTALLMENT'
  | 'DUE_BEFORE_START';

export type LoanTermsValidation = { ok: true } | { ok: false; code: LoanTermsError };

const MONTHS_PER_YEAR = 12;
const DAYS_PER_YEAR = 365;
const RATE_SEARCH_STEPS = 200;

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export function totalToRepay(loan: InstallmentLoan): Rupiah {
  return loan.installmentAmount * loan.installmentCount;
}

/** Everything repaid beyond what was received. */
export function costOfBorrowing(loan: InstallmentLoan): Rupiah {
  return totalToRepay(loan) - loan.received;
}

function amountsError(loan: InstallmentLoan): LoanTermsError | null {
  if (!Number.isSafeInteger(loan.received) || loan.received <= 0) return 'INVALID_AMOUNT';
  if (!Number.isSafeInteger(loan.installmentAmount) || loan.installmentAmount <= 0) return 'INVALID_INSTALLMENT';
  return null;
}

function scheduleError(loan: InstallmentLoan): LoanTermsError | null {
  if (!Number.isInteger(loan.installmentCount) || loan.installmentCount < 1) return 'INVALID_COUNT';
  if (loan.frequency === 'single' && loan.installmentCount !== 1) return 'SINGLE_NEEDS_ONE_INSTALLMENT';
  if (costOfBorrowing(loan) < 0) return 'REPAYS_LESS_THAN_RECEIVED';
  return loan.firstDueDate < loan.startDate ? 'DUE_BEFORE_START' : null;
}

export function validateLoanTerms(loan: InstallmentLoan): LoanTermsValidation {
  const code = amountsError(loan) ?? scheduleError(loan);
  return code ? { ok: false, code } : { ok: true };
}

// ---------------------------------------------------------------------------
// Yearly rate
// ---------------------------------------------------------------------------

function presentValueGap(loan: InstallmentLoan, monthlyRate: number): number {
  let value = 0;
  for (let k = 1; k <= loan.installmentCount; k++) value += loan.installmentAmount / (1 + monthlyRate) ** k;
  return value - loan.received;
}

/** The monthly rate at which the installments are worth exactly what was received (bisection). */
function monthlyRate(loan: InstallmentLoan): number {
  let high = 1;
  while (presentValueGap(loan, high) > 0 && high < 1e6) high *= 2;
  let low = 0;
  for (let step = 0; step < RATE_SEARCH_STEPS; step++) {
    const middle = (low + high) / 2;
    if (presentValueGap(loan, middle) > 0) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/**
 * An approximate yearly rate, as a ratio (3.65 = 365%). Monthly loans: the monthly rate times 12.
 * A single payment: the cost over what was received, scaled to a year.
 */
export function approximateYearlyRate(loan: InstallmentLoan): number {
  if (costOfBorrowing(loan) <= 0) return 0;
  if (loan.frequency === 'monthly') return monthlyRate(loan) * MONTHS_PER_YEAR;
  const days = Math.max(1, daysBetween(loan.startDate, loan.firstDueDate));
  return ((costOfBorrowing(loan) / loan.received) * DAYS_PER_YEAR) / days;
}

// ---------------------------------------------------------------------------
// Schedule and interest split
// ---------------------------------------------------------------------------

export function dueDates(loan: InstallmentLoan): DateString[] {
  if (loan.frequency === 'single') return [loan.firstDueDate];
  const anchor = dayOfMonth(loan.firstDueDate);
  return Array.from({ length: loan.installmentCount }, (_, index) => addMonthsToDate(loan.firstDueDate, index, anchor));
}

/** The interest part of installment `number`: even shares, the last one takes the remainder. */
export function interestShare(loan: InstallmentLoan, number: number): Rupiah {
  const cost = Math.max(0, costOfBorrowing(loan));
  const even = Math.floor(cost / loan.installmentCount);
  return number >= loan.installmentCount ? cost - even * (loan.installmentCount - 1) : even;
}

function interestOfFirst(loan: InstallmentLoan, installments: number): Rupiah {
  const cost = Math.max(0, costOfBorrowing(loan));
  if (installments <= 0) return 0;
  if (installments >= loan.installmentCount) return cost;
  return installments * Math.floor(cost / loan.installmentCount);
}

export function installmentsPaid(loan: InstallmentLoan, totalPaid: Rupiah): number {
  return Math.min(loan.installmentCount, Math.floor(totalPaid / loan.installmentAmount));
}

/** The interest contained in the first `totalPaid` rupiah repaid (a part-paid installment counts pro rata). */
export function interestPaidThrough(loan: InstallmentLoan, totalPaid: Rupiah): Rupiah {
  const full = installmentsPaid(loan, totalPaid);
  if (full >= loan.installmentCount) return Math.max(0, costOfBorrowing(loan));
  const partial = totalPaid - full * loan.installmentAmount;
  const partialInterest = Math.floor((partial * interestShare(loan, full + 1)) / loan.installmentAmount);
  return interestOfFirst(loan, full) + partialInterest;
}

/** What is still owed of the amount received, after `totalPaid` has been repaid. */
export function principalOwed(loan: InstallmentLoan, totalPaid: Rupiah): Rupiah {
  const principalPaid = totalPaid - interestPaidThrough(loan, totalPaid);
  return Math.max(0, loan.received - principalPaid);
}

/** The installments not yet paid, with their due dates; the owed amount caps what is asked. */
export function unpaidInstallments(loan: InstallmentLoan, totalPaid: Rupiah, owed: Rupiah): UnpaidInstallment[] {
  const dates = dueDates(loan);
  let remaining = owed;
  const unpaid: UnpaidInstallment[] = [];
  for (let index = installmentsPaid(loan, totalPaid); index < dates.length && remaining > 0; index++) {
    const amount = Math.min(loan.installmentAmount, remaining);
    unpaid.push({ number: index + 1, date: dates[index]!, amount });
    remaining -= amount;
  }
  return unpaid;
}

/** Interest saved by paying off early: what was cleared minus what was actually paid. */
export function earlyPayoffSaving(cleared: Rupiah, paid: Rupiah): Rupiah {
  return Math.max(0, cleared - paid);
}

// ---------------------------------------------------------------------------
// From transactions
// ---------------------------------------------------------------------------

/** Payments and the payoff of one loan, oldest first. */
function repayments(transactions: readonly Transaction[], loanId: string): Transaction[] {
  return activeTransactions(transactions)
    .filter((tx) => tx.debtId === loanId && (tx.kind === 'debt_payment' || tx.kind === 'debt_payoff'))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Total repaid through installment payments (a payoff closes the loan and is not counted). */
export function totalPaidOn(transactions: readonly Transaction[], loanId: string): Rupiah {
  return repayments(transactions, loanId)
    .filter((tx) => tx.kind === 'debt_payment')
    .reduce((total, tx) => total + tx.amount, 0);
}

export function owedOn(transactions: readonly Transaction[], loanId: string): Rupiah {
  return scopedBalance(transactions, 'debt', loanId);
}

/** The interest part of each repayment, by month. A payoff's interest is what it pays beyond the principal. */
export function interestByMonth(loan: InstallmentLoan, transactions: readonly Transaction[]): Map<Month, Rupiah> {
  const byMonth = new Map<Month, Rupiah>();
  let paid = 0;
  for (const tx of repayments(transactions, loan.id)) {
    const interest = tx.kind === 'debt_payoff'
      ? Math.max(0, tx.amount - principalOwed(loan, paid))
      : interestPaidThrough(loan, paid + tx.amount) - interestPaidThrough(loan, paid);
    paid += tx.amount;
    byMonth.set(monthOf(tx.date), (byMonth.get(monthOf(tx.date)) ?? 0) + interest);
  }
  return byMonth;
}

function businessLoans(loans: readonly InstallmentLoan[]): InstallmentLoan[] {
  return loans.filter((loan) => loan.purpose === 'business');
}

/** What business loans cost the work, by month: the interest of each payment plus late fees. */
export function businessLoanCostsByMonth(
  loans: readonly InstallmentLoan[],
  transactions: readonly Transaction[],
): Map<Month, Rupiah> {
  const costs = new Map<Month, Rupiah>();
  const add = (month: Month, amount: Rupiah) => costs.set(month, (costs.get(month) ?? 0) + amount);
  for (const loan of businessLoans(loans)) {
    for (const [month, amount] of interestByMonth(loan, transactions)) add(month, amount);
    const fees = activeTransactions(transactions).filter((tx) => tx.kind === 'debt_cost' && tx.debtId === loan.id);
    for (const fee of fees) add(monthOf(fee.date), fee.amount);
  }
  return costs;
}

/** Principal of open business loans that is still owed. Borrowed money is not the user's. */
export function businessPrincipalOwed(loans: readonly InstallmentLoan[], transactions: readonly Transaction[]): Rupiah {
  return businessLoans(loans).reduce((total, loan) => {
    const owed = owedOn(transactions, loan.id);
    if (owed <= 0) return total;
    return total + Math.min(owed, principalOwed(loan, totalPaidOn(transactions, loan.id)));
  }, 0);
}

/** Monthly installments of open business loans; they are paid from the Pool. */
export function businessLoanCommitment(loans: readonly InstallmentLoan[], transactions: readonly Transaction[]): Rupiah {
  return businessLoans(loans)
    .filter((loan) => loan.frequency === 'monthly' && owedOn(transactions, loan.id) > 0)
    .reduce((total, loan) => total + loan.installmentAmount, 0);
}
