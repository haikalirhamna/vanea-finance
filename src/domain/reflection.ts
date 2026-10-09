/** Monthly reflection: totals, highlights and intention vs actual (SYSTEM-OVERVIEW §8). */
import { DateString, Month, addMonths, monthOf } from './calendar';
import { CONFIG } from './config';
import { Rupiah, sum } from './money';
import { EXPENSE_CATEGORIES, ExpenseCategory, Transaction, activeTransactions } from './ledger';
import { mean } from './statistics';

export type CategoryTotals = Record<ExpenseCategory, Rupiah>;

export interface Highlight {
  category: ExpenseCategory;
  current: Rupiah;
  /** Average of the 3 previous months. */
  average: Rupiah;
  delta: Rupiah;
  /** The category had no spending in the previous months. */
  isNewSpending: boolean;
}

export interface MonthSummary {
  month: Month;
  /** Salary paid to the user in the month. */
  received: Rupiah;
  spent: CategoryTotals;
  totalSpent: Rupiah;
  setAside: Rupiah;
}

export interface MonthlyIntention {
  setAsideAmount: Rupiah;
  wantsLimit: Rupiah | null;
}

export interface IntentionComparison {
  setAsideIntended: Rupiah;
  setAsideActual: Rupiah;
  /** Positive when less was set aside than intended. */
  setAsideShortfall: Rupiah;
  wantsSpent: Rupiah;
  wantsLimit: Rupiah | null;
  wantsOverLimit: boolean;
}

function inMonth(tx: Transaction, month: Month): boolean {
  return monthOf(tx.date) === month;
}

export function expenseTotals(transactions: readonly Transaction[], month: Month): CategoryTotals {
  const totals: CategoryTotals = { needs: 0, wants: 0, growth: 0, unexpected: 0 };
  for (const tx of activeTransactions(transactions)) {
    if (tx.kind === 'expense' && tx.expenseCategory && inMonth(tx, month)) totals[tx.expenseCategory] += tx.amount;
  }
  return totals;
}

const SET_ASIDE_SIGN: Partial<Record<Transaction['kind'], 1 | -1>> = {
  savings_deposit: 1,
  investment_contribution: 1,
  savings_withdrawal: -1,
  investment_withdrawal: -1,
};

/** Net money moved from personal spending into savings and investments (Pool surplus excluded). */
export function setAsideIn(transactions: readonly Transaction[], month: Month): Rupiah {
  return activeTransactions(transactions)
    .filter((tx) => inMonth(tx, month))
    .reduce((total, tx) => total + (SET_ASIDE_SIGN[tx.kind] ?? 0) * tx.amount, 0);
}

export function salaryReceivedIn(transactions: readonly Transaction[], month: Month): Rupiah {
  return sum(
    activeTransactions(transactions)
      .filter((tx) => tx.kind === 'salary_payment' && inMonth(tx, month))
      .map((tx) => tx.amount),
  );
}

export function summarizeMonth(transactions: readonly Transaction[], month: Month): MonthSummary {
  const spent = expenseTotals(transactions, month);
  return {
    month,
    received: salaryReceivedIn(transactions, month),
    spent,
    totalSpent: sum(Object.values(spent)),
    setAside: setAsideIn(transactions, month),
  };
}

/** The 3 months before `month`, or null if any is not a full month after onboarding. */
function observedPreviousMonths(month: Month, onboardedOn: DateString): Month[] | null {
  const previous = [1, 2, 3].map((back) => addMonths(month, -back));
  return previous.every((m) => m > monthOf(onboardedOn)) ? previous : null;
}

function isNotable(current: Rupiah, average: number): boolean {
  const delta = Math.abs(current - average);
  if (delta <= CONFIG.HIGHLIGHT_MIN_AMOUNT) return false;
  return average === 0 || delta > CONFIG.HIGHLIGHT_RELATIVE_CHANGE * average;
}

function highlightFor(category: ExpenseCategory, current: Rupiah, previous: readonly CategoryTotals[]): Highlight | null {
  const average = mean(previous.map((totals) => totals[category]));
  if (!isNotable(current, average)) return null;
  return {
    category,
    current,
    average: Math.round(average),
    delta: Math.round(current - average),
    isNewSpending: average === 0,
  };
}

/**
 * Up to two categories that moved meaningfully against the previous 3 months.
 * Needs 3 full observed months before `month`; otherwise there are none.
 */
export function findHighlights(
  transactions: readonly Transaction[],
  month: Month,
  onboardedOn: DateString,
): Highlight[] {
  const previousMonths = observedPreviousMonths(month, onboardedOn);
  if (!previousMonths) return [];
  const previous = previousMonths.map((m) => expenseTotals(transactions, m));
  const current = expenseTotals(transactions, month);
  return EXPENSE_CATEGORIES.map((category) => highlightFor(category, current[category], previous))
    .filter((highlight): highlight is Highlight => highlight !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, CONFIG.HIGHLIGHT_MAX_ITEMS);
}

/** Intention against what happened, as plain amounts (no score). */
export function compareIntention(intention: MonthlyIntention, summary: MonthSummary): IntentionComparison {
  const wantsSpent = summary.spent.wants;
  return {
    setAsideIntended: intention.setAsideAmount,
    setAsideActual: summary.setAside,
    setAsideShortfall: Math.max(0, intention.setAsideAmount - summary.setAside),
    wantsSpent,
    wantsLimit: intention.wantsLimit,
    wantsOverLimit: intention.wantsLimit !== null && wantsSpent > intention.wantsLimit,
  };
}
