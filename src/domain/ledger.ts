/**
 * Balances, the never-negative invariant and reversals (SYSTEM-OVERVIEW §6.1, §6.2, §6.7).
 * Types live in ledger-types.ts, movement rules in ledger-movements.ts, validation in ledger-validation.ts.
 */
import { DateString } from './calendar';
import { Rupiah } from './money';
import { allMovements } from './ledger-movements';
import { Account, Movement, Transaction } from './ledger-types';

export * from './ledger-types';
export { allMovements, movementsOf } from './ledger-movements';

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

function sumWhere(
  movements: readonly Movement[],
  account: Account,
  refId: string | undefined,
  include: (movement: Movement) => boolean,
): Rupiah {
  return movements
    .filter((m) => m.account === account && (refId === undefined || m.refId === refId) && include(m))
    .reduce((total, m) => total + m.amount, 0);
}

/** Balance of an account; for scoped accounts pass `refId` to read one holding, line or debt. */
export function balanceOf(movements: readonly Movement[], account: Account, refId?: string): Rupiah {
  return sumWhere(movements, account, refId, () => true);
}

/** Balance at the end of `date`. */
export function balanceThrough(
  movements: readonly Movement[],
  account: Account,
  date: DateString,
  refId?: string,
): Rupiah {
  return sumWhere(movements, account, refId, (m) => m.date <= date);
}

/** Balance at the start of `date`. */
export function balanceBefore(
  movements: readonly Movement[],
  account: Account,
  date: DateString,
  refId?: string,
): Rupiah {
  return sumWhere(movements, account, refId, (m) => m.date < date);
}

/** Balance of one holding, credit line or debt, computed from the transactions. */
export function scopedBalance(transactions: readonly Transaction[], account: Account, refId: string): Rupiah {
  return balanceOf(allMovements(transactions), account, refId);
}

interface DailyBalance {
  date: DateString;
  balance: Rupiah;
}

/** End-of-day balance for every date on which the group moved, oldest first. */
function dailyBalances(movements: readonly Movement[]): DailyBalance[] {
  const ordered = [...movements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
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

/** One group per account and reference id (a holding, a credit line, a debt). */
function groupMovements(movements: readonly Movement[]): Map<string, Movement[]> {
  const groups = new Map<string, Movement[]>();
  for (const movement of movements) {
    const key = `${movement.account}|${movement.refId ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), movement]);
  }
  return groups;
}

export interface Shortfall {
  account: Account;
  refId?: string;
  /** The first date the balance ends the day below zero. */
  date: DateString;
  /** How far below zero it ends that day. */
  shortfall: Rupiah;
}

/**
 * The first account (other than personal) that ends a day negative.
 * Personal spending may go negative; everything else may not.
 */
export function findShortfall(movements: readonly Movement[]): Shortfall | null {
  for (const group of groupMovements(movements.filter((m) => m.account !== 'personal')).values()) {
    const day = dailyBalances(group).find((entry) => entry.balance < 0);
    const first = group[0]!;
    if (day) {
      const base = { account: first.account, date: day.date, shortfall: -day.balance };
      return first.refId === undefined ? base : { ...base, refId: first.refId };
    }
  }
  return null;
}

/**
 * The most that can be taken out of an account on `date` without it ever
 * ending a day negative from `date` onwards (SYSTEM-OVERVIEW §6.2).
 */
export function maxDebitAllowed(
  transactions: readonly Transaction[],
  account: Account,
  date: DateString,
  refId?: string,
): Rupiah {
  const group = allMovements(transactions).filter(
    (m) => m.account === account && (refId === undefined || m.refId === refId),
  );
  const laterDays = dailyBalances(group).filter((entry) => entry.date > date);
  const lowest = Math.min(balanceThrough(group, account, date), ...laterDays.map((d) => d.balance));
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
