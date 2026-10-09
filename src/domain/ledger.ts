/**
 * The ledger: accounts, immutable transactions, the movements they cause,
 * balances, reversals and the "Pool never negative" invariant (SYSTEM-OVERVIEW §6.1, §6.2, §6.7).
 */
import { DateString, Month, isDateString, isMonth } from './calendar';
import { Rupiah, isRupiah } from './money';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ACCOUNTS = ['pool', 'personal', 'savings', 'investment'] as const;
export type Account = (typeof ACCOUNTS)[number];

export const EXPENSE_CATEGORIES = ['needs', 'wants', 'growth', 'unexpected'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const BUSINESS_COST_CATEGORIES = ['subscription', 'tools', 'tax', 'other'] as const;
export type BusinessCostCategory = (typeof BUSINESS_COST_CATEGORIES)[number];

export type TransactionKind =
  | 'opening_balance'
  | 'income'
  | 'business_cost'
  | 'salary_payment'
  | 'expense'
  | 'savings_deposit'
  | 'savings_withdrawal'
  | 'investment_contribution'
  | 'investment_withdrawal'
  | 'surplus_allocation'
  | 'advance_disbursement'
  | 'advance_early_repayment'
  | 'reversal';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  date: DateString;
  amount: Rupiah;
  /** opening_balance: the account; surplus_allocation: the destination (savings or investment). */
  account?: Account;
  /** reversal only: the transaction being reversed. */
  reversesId?: string;
  expenseCategory?: ExpenseCategory;
  businessCostCategory?: BusinessCostCategory;
  /** salary_payment only: the salary period `YYYY-MM`. */
  salaryPeriod?: Month;
  /** salary_payment only: part of the salary withheld to repay an advance. */
  advanceInstallment?: Rupiah;
  advanceId?: string;
}

export interface Movement {
  transactionId: string;
  account: Account;
  /** Signed, non-zero. */
  amount: Rupiah;
  date: DateString;
}

export interface LedgerRules {
  today: DateString;
  onboardedOn: DateString;
}

export type LedgerErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_DATE'
  | 'DATE_IN_FUTURE'
  | 'DATE_BEFORE_ONBOARDING'
  | 'MISSING_FIELD'
  | 'ORIGINAL_NOT_FOUND'
  | 'NOT_REVERSIBLE'
  | 'ALREADY_REVERSED'
  | 'REVERSAL_AMOUNT_MISMATCH'
  | 'INSUFFICIENT_BALANCE';

export type LedgerValidation =
  | { ok: true }
  | {
      ok: false;
      code: LedgerErrorCode;
      transactionId?: string;
      /** INSUFFICIENT_BALANCE: the account that would go negative. */
      account?: Account;
      /** INSUFFICIENT_BALANCE: the first date it goes negative. */
      date?: DateString;
      /** INSUFFICIENT_BALANCE: how far below zero it goes on that date. */
      shortfall?: Rupiah;
    };

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------

interface Entry {
  account: Account;
  amount: Rupiah;
}

type ForwardKind = Exclude<TransactionKind, 'reversal'>;

const credit = (account: Account, amount: Rupiah): Entry => ({ account, amount });
const debit = (account: Account, amount: Rupiah): Entry => ({ account, amount: -amount });

function requireAccount(tx: Transaction): Account {
  if (!tx.account) throw new Error(`Transaction ${tx.id} (${tx.kind}) requires an account`);
  return tx.account;
}

const FORWARD_ENTRIES: Record<ForwardKind, (tx: Transaction) => Entry[]> = {
  opening_balance: (tx) => [credit(requireAccount(tx), tx.amount)],
  income: (tx) => [credit('pool', tx.amount)],
  business_cost: (tx) => [debit('pool', tx.amount)],
  salary_payment: (tx) => [debit('pool', tx.amount), credit('personal', tx.amount)],
  expense: (tx) => [debit('personal', tx.amount)],
  savings_deposit: (tx) => [debit('personal', tx.amount), credit('savings', tx.amount)],
  savings_withdrawal: (tx) => [debit('savings', tx.amount), credit('personal', tx.amount)],
  investment_contribution: (tx) => [debit('personal', tx.amount), credit('investment', tx.amount)],
  investment_withdrawal: (tx) => [debit('investment', tx.amount), credit('personal', tx.amount)],
  surplus_allocation: (tx) => [debit('pool', tx.amount), credit(requireAccount(tx), tx.amount)],
  advance_disbursement: (tx) => [debit('pool', tx.amount), credit('personal', tx.amount)],
  advance_early_repayment: (tx) => [debit('personal', tx.amount), credit('pool', tx.amount)],
};

function forwardEntries(tx: Transaction): Entry[] {
  if (tx.kind === 'reversal') throw new Error('A reversal cannot be reversed');
  return FORWARD_ENTRIES[tx.kind](tx);
}

function reversalEntries(reversal: Transaction, original: Transaction): Entry[] {
  // An income reversal removes only what the Pool can absorb (SYSTEM-OVERVIEW §6.5).
  if (original.kind === 'income') return [debit('pool', reversal.amount)];
  return forwardEntries(original).map((entry) => ({ account: entry.account, amount: -entry.amount }));
}

/** The movements one transaction causes. A reversal needs its original. */
export function movementsOf(tx: Transaction, original?: Transaction): Movement[] {
  if (tx.kind === 'reversal' && !original) {
    throw new Error(`Reversal ${tx.id} needs its original transaction`);
  }
  const entries = tx.kind === 'reversal' ? reversalEntries(tx, original!) : forwardEntries(tx);
  return entries
    .filter((entry) => entry.amount !== 0)
    .map((entry) => ({ transactionId: tx.id, date: tx.date, ...entry }));
}

export function allMovements(transactions: readonly Transaction[]): Movement[] {
  const byId = new Map(transactions.map((tx) => [tx.id, tx]));
  return transactions.flatMap((tx) =>
    movementsOf(tx, tx.reversesId === undefined ? undefined : byId.get(tx.reversesId)),
  );
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

function sumWhere(
  movements: readonly Movement[],
  account: Account,
  include: (movement: Movement) => boolean,
): Rupiah {
  return movements
    .filter((movement) => movement.account === account && include(movement))
    .reduce((total, movement) => total + movement.amount, 0);
}

export function balanceOf(movements: readonly Movement[], account: Account): Rupiah {
  return sumWhere(movements, account, () => true);
}

/** Balance at the end of `date`. */
export function balanceThrough(movements: readonly Movement[], account: Account, date: DateString): Rupiah {
  return sumWhere(movements, account, (movement) => movement.date <= date);
}

/** Balance at the start of `date`. */
export function balanceBefore(movements: readonly Movement[], account: Account, date: DateString): Rupiah {
  return sumWhere(movements, account, (movement) => movement.date < date);
}

interface DailyBalance {
  date: DateString;
  balance: Rupiah;
}

/** End-of-day balance for every date on which the account moved, oldest first. */
function dailyBalances(movements: readonly Movement[], account: Account): DailyBalance[] {
  const ordered = movements
    .filter((movement) => movement.account === account)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const days: DailyBalance[] = [];
  let running = 0;
  for (const movement of ordered) {
    running += movement.amount;
    const last = days[days.length - 1];
    if (last && last.date === movement.date) last.balance = running;
    else days.push({ date: movement.date, balance: running });
  }
  return days;
}

/** The first date on which the account ends the day below zero. */
function firstShortfall(
  movements: readonly Movement[],
  account: Account,
): { date: DateString; shortfall: Rupiah } | null {
  const day = dailyBalances(movements, account).find((entry) => entry.balance < 0);
  return day ? { date: day.date, shortfall: -day.balance } : null;
}

/**
 * The most that can be taken out of an account on `date` without it ever
 * ending a day negative from `date` onwards (SYSTEM-OVERVIEW §6.2).
 */
export function maxDebitAllowed(
  transactions: readonly Transaction[],
  account: Account,
  date: DateString,
): Rupiah {
  const movements = allMovements(transactions);
  const laterDays = dailyBalances(movements, account).filter((entry) => entry.date > date);
  const lowest = Math.min(balanceThrough(movements, account, date), ...laterDays.map((d) => d.balance));
  return Math.max(0, lowest);
}

// ---------------------------------------------------------------------------
// Reversals
// ---------------------------------------------------------------------------

export function reversedIds(transactions: readonly Transaction[]): Set<string> {
  const ids = new Set<string>();
  for (const tx of transactions) {
    if (tx.kind === 'reversal' && tx.reversesId !== undefined) ids.add(tx.reversesId);
  }
  return ids;
}

/** Transactions that still count: neither a reversal nor reversed (they cancel out). */
export function activeTransactions(transactions: readonly Transaction[]): Transaction[] {
  const reversed = reversedIds(transactions);
  return transactions.filter((tx) => tx.kind !== 'reversal' && !reversed.has(tx.id));
}

export function createReversal(
  original: Transaction,
  params: { id: string; date: DateString; amount?: Rupiah },
): Transaction {
  return {
    id: params.id,
    kind: 'reversal',
    date: params.date,
    amount: params.amount ?? original.amount,
    reversesId: original.id,
  };
}

export interface IncomeReversalPlan {
  /** What the Pool can give back now. */
  poolPart: Rupiah;
  /** What the Pool cannot absorb; becomes a salary advance (SYSTEM-OVERVIEW §6.5). */
  remainder: Rupiah;
}

/** Splits an income reversal into the part the Pool can absorb and the remainder. */
export function planIncomeReversal(
  transactions: readonly Transaction[],
  incomeId: string,
  date: DateString,
): IncomeReversalPlan {
  const income = transactions.find((tx) => tx.id === incomeId);
  if (!income || income.kind !== 'income') throw new Error(`${incomeId} is not an income transaction`);
  if (reversedIds(transactions).has(incomeId)) throw new Error(`${incomeId} is already reversed`);
  const poolPart = Math.min(income.amount, maxDebitAllowed(transactions, 'pool', date));
  return { poolPart, remainder: income.amount - poolPart };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const OK: LedgerValidation = { ok: true };
const NON_NEGATIVE_ACCOUNTS: readonly Account[] = ['pool', 'savings', 'investment'];

function isZeroAmountAllowed(tx: Transaction): boolean {
  if (tx.kind === 'reversal') return true;
  // A fully withheld salary period still records its advance installment.
  return tx.kind === 'salary_payment' && (tx.advanceInstallment ?? 0) > 0;
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

const HAS_REQUIRED_FIELDS: Record<TransactionKind, (tx: Transaction) => boolean> = {
  opening_balance: (tx) => tx.account !== undefined && ACCOUNTS.includes(tx.account),
  income: () => true,
  business_cost: (tx) => tx.businessCostCategory !== undefined,
  salary_payment: (tx) =>
    tx.salaryPeriod !== undefined &&
    isMonth(tx.salaryPeriod) &&
    (tx.advanceInstallment === undefined || (isRupiah(tx.advanceInstallment) && tx.advanceInstallment >= 0)),
  expense: (tx) => tx.expenseCategory !== undefined,
  savings_deposit: () => true,
  savings_withdrawal: () => true,
  investment_contribution: () => true,
  investment_withdrawal: () => true,
  surplus_allocation: (tx) => tx.account === 'savings' || tx.account === 'investment',
  advance_disbursement: (tx) => !!tx.advanceId,
  advance_early_repayment: (tx) => !!tx.advanceId,
  reversal: (tx) => !!tx.reversesId,
};

function checkFields(tx: Transaction): LedgerErrorCode | null {
  return HAS_REQUIRED_FIELDS[tx.kind](tx) ? null : 'MISSING_FIELD';
}

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

function firstStructuralError(
  tx: Transaction,
  all: readonly Transaction[],
  rules: LedgerRules,
): LedgerErrorCode | null {
  return checkAmount(tx) ?? checkDate(tx, rules) ?? checkFields(tx) ?? checkReversal(tx, all);
}

function checkBalances(all: readonly Transaction[]): LedgerValidation {
  const movements = allMovements(all);
  for (const account of NON_NEGATIVE_ACCOUNTS) {
    const shortfall = firstShortfall(movements, account);
    if (shortfall) return { ok: false, code: 'INSUFFICIENT_BALANCE', account, ...shortfall };
  }
  return OK;
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
