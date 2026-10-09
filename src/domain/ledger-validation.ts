/** Whether a batch of transactions may be recorded (SYSTEM-OVERVIEW §6.2, §6.7). */
import { isDateString, isMonth } from './calendar';
import { isRupiah } from './money';
import { findShortfall } from './ledger';
import { allMovements } from './ledger-movements';
import {
  BUSINESS_COST_CATEGORIES, EXPENSE_CATEGORIES, LedgerErrorCode, LedgerRules,
  LedgerValidation, OPENING_ACCOUNTS, Transaction, TransactionKind,
} from './ledger-types';

const OK: LedgerValidation = { ok: true };

function isNonNegativeRupiah(value: number | undefined): boolean {
  return value !== undefined && isRupiah(value) && value >= 0;
}

const DEBT_KINDS = ['credit_line', 'installment'];

// ---------------------------------------------------------------------------
// Amount, date
// ---------------------------------------------------------------------------

/** Kinds that may record 0: a fully withheld salary period, a sale at a total loss, a reversal when the Pool is empty. */
function isZeroAmountAllowed(tx: Transaction): boolean {
  if (tx.kind === 'reversal') return true;
  if (tx.kind === 'salary_payment') return (tx.advanceInstallment ?? 0) > 0;
  return tx.kind === 'investment_sale' && (tx.costRemoved ?? 0) > 0;
}

function checkAmount(tx: Transaction): LedgerErrorCode | null {
  if (!isRupiah(tx.amount)) return 'INVALID_AMOUNT';
  const minimum = isZeroAmountAllowed(tx) ? 0 : 1;
  return tx.amount >= minimum ? null : 'INVALID_AMOUNT';
}

function checkDate(tx: Transaction, rules: LedgerRules): LedgerErrorCode | null {
  if (!isDateString(tx.date)) return 'INVALID_DATE';
  if (tx.date > rules.today) return 'DATE_IN_FUTURE';
  if (tx.date < rules.onboardedOn) return 'DATE_BEFORE_ONBOARDING';
  return null;
}

// ---------------------------------------------------------------------------
// Required fields per kind
// ---------------------------------------------------------------------------

const has = (value: string | undefined): boolean => !!value;

function isValidOpening(tx: Transaction): boolean {
  if (tx.account === undefined || !OPENING_ACCOUNTS.includes(tx.account)) return false;
  return tx.account !== 'debt' || has(tx.debtId);
}

function isValidSalaryPayment(tx: Transaction): boolean {
  return tx.salaryPeriod !== undefined && isMonth(tx.salaryPeriod) &&
    (tx.advanceInstallment === undefined || isNonNegativeRupiah(tx.advanceInstallment));
}

function isValidBusinessCost(tx: Transaction): boolean {
  if (!tx.businessCostCategory || !BUSINESS_COST_CATEGORIES.includes(tx.businessCostCategory)) return false;
  return tx.businessCostCategory !== 'subscription' || tx.billingCycle === 'monthly' || tx.billingCycle === 'yearly';
}

function isValidExpense(tx: Transaction): boolean {
  if (!tx.expenseCategory || !EXPENSE_CATEGORIES.includes(tx.expenseCategory)) return false;
  return tx.paymentMethod === undefined || tx.paymentMethod === 'available' || has(tx.debtId);
}

function isValidDebtCost(tx: Transaction): boolean {
  return has(tx.debtId) && tx.debtCostType !== undefined && DEBT_KINDS.includes(tx.paymentMethod ?? '');
}

function isValidDebtPayment(tx: Transaction): boolean {
  if (!has(tx.debtId) || !DEBT_KINDS.includes(tx.paymentMethod ?? '')) return false;
  if (tx.sourceAccount !== 'personal' && tx.sourceAccount !== 'pool') return false;
  const reserve = tx.reservePart ?? 0;
  if (!isNonNegativeRupiah(reserve) || reserve > tx.amount) return false;
  return tx.paymentMethod === 'credit_line' || reserve === 0;
}

function isValidDebtPayoff(tx: Transaction): boolean {
  const source = tx.sourceAccount;
  return has(tx.debtId) && (source === 'personal' || source === 'pool') && isNonNegativeRupiah(tx.clearedAmount);
}

function isValidLoanStart(tx: Transaction): boolean {
  const destination = tx.destinationAccount;
  const destinationOk = destination === undefined || destination === 'personal' || destination === 'pool';
  return has(tx.debtId) && destinationOk && isNonNegativeRupiah(tx.totalOwed) && (tx.totalOwed ?? 0) >= tx.amount;
}

function isValidConversion(tx: Transaction): boolean {
  const reserve = tx.reservePart;
  return has(tx.debtId) && has(tx.targetDebtId) && tx.debtId !== tx.targetDebtId &&
    isNonNegativeRupiah(reserve) && (reserve ?? 0) <= tx.amount && isNonNegativeRupiah(tx.totalOwed);
}

function hasCashDestination(tx: Transaction): boolean {
  return tx.destinationAccount === 'personal' || tx.destinationAccount === 'savings';
}

function isValidSurplus(tx: Transaction): boolean {
  if (tx.account === 'savings') return true;
  return tx.account === 'investment' && has(tx.holdingId);
}

const HAS_REQUIRED_FIELDS: Record<TransactionKind, (tx: Transaction) => boolean> = {
  opening_balance: isValidOpening,
  bill_reserve_set_aside: (tx) => has(tx.debtId),
  income: () => true,
  business_cost: isValidBusinessCost,
  salary_payment: isValidSalaryPayment,
  expense: isValidExpense,
  debt_cost: isValidDebtCost,
  debt_payment: isValidDebtPayment,
  debt_payoff: isValidDebtPayoff,
  loan_start: isValidLoanStart,
  credit_conversion: isValidConversion,
  savings_deposit: () => true,
  savings_withdrawal: () => true,
  investment_contribution: (tx) => has(tx.holdingId),
  investment_sale: (tx) => has(tx.holdingId) && isNonNegativeRupiah(tx.costRemoved) && hasCashDestination(tx),
  investment_income: (tx) => has(tx.holdingId),
  investment_cash_withdrawal: (tx) => has(tx.holdingId) && hasCashDestination(tx),
  surplus_allocation: isValidSurplus,
  advance_disbursement: (tx) => has(tx.advanceId),
  advance_early_repayment: (tx) => has(tx.advanceId),
  reversal: (tx) => has(tx.reversesId),
};

function checkFields(tx: Transaction): LedgerErrorCode | null {
  return HAS_REQUIRED_FIELDS[tx.kind](tx) ? null : 'MISSING_FIELD';
}

// ---------------------------------------------------------------------------
// Reversals
// ---------------------------------------------------------------------------

function reversalAmountError(reversal: Transaction, original: Transaction): LedgerErrorCode | null {
  // Only an income reversal may be partial (the Pool-absorbable part).
  const valid = original.kind === 'income' ? reversal.amount <= original.amount : reversal.amount === original.amount;
  return valid ? null : 'REVERSAL_AMOUNT_MISMATCH';
}

function checkReversal(reversal: Transaction, all: readonly Transaction[]): LedgerErrorCode | null {
  if (reversal.kind !== 'reversal') return null;
  const original = all.find((tx) => tx.id === reversal.reversesId);
  if (!original) return 'ORIGINAL_NOT_FOUND';
  if (original.kind === 'reversal') return 'NOT_REVERSIBLE';
  if (all.filter((tx) => tx.kind === 'reversal' && tx.reversesId === original.id).length > 1) {
    return 'ALREADY_REVERSED';
  }
  if (reversal.date < original.date) return 'INVALID_DATE';
  return reversalAmountError(reversal, original);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function firstStructuralError(
  tx: Transaction,
  all: readonly Transaction[],
  rules: LedgerRules,
): LedgerErrorCode | null {
  return checkAmount(tx) ?? checkDate(tx, rules) ?? checkFields(tx) ?? checkReversal(tx, all);
}

function checkBalances(all: readonly Transaction[]): LedgerValidation {
  const shortfall = findShortfall(allMovements(all));
  return shortfall ? { ok: false, code: 'INSUFFICIENT_BALANCE', ...shortfall } : OK;
}

/**
 * Validates `additions` as one batch on top of `existing`. Batches let a
 * correction (reversal + replacement) be judged by its final state.
 */
export function validateTransactions(
  existing: readonly Transaction[],
  additions: readonly Transaction[],
  rules: LedgerRules,
): LedgerValidation {
  const all = [...existing, ...additions];
  for (const tx of additions) {
    const code = firstStructuralError(tx, all, rules);
    if (code) return { ok: false, code, transactionId: tx.id };
  }
  return checkBalances(all);
}
