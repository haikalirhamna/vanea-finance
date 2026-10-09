/** Available Spending insights: daily allowance and pace (SYSTEM-OVERVIEW §7). */
import {
  DateString,
  currentPeriod,
  dayOfMonth,
  daysBetween,
  nextPayday,
  periodStart,
} from './calendar';
import { CONFIG } from './config';
import { Rupiah } from './money';
import { Transaction, activeTransactions, allMovements, balanceBefore, balanceOf } from './ledger';

export interface DailyAllowance {
  nextPayday: DateString;
  /** Days from today until the next payday (at least 1). */
  daysLeft: number;
  /** Null while overspent: there is nothing to spread. */
  amount: Rupiah | null;
  overspent: boolean;
  /** Today is payday and this period's salary has not been fully paid. */
  salaryDueToday: boolean;
}

export interface Pace {
  /** Share of this period's money already spent, 0–1+. */
  spentRatio: number;
  /** Share of the period that has passed, 0–1. Today counts as passed. */
  elapsedRatio: number;
  /** Spending runs more than 15 points ahead of time. */
  ahead: boolean;
}

/** Available Spending is the balance of the personal account; it rolls over and may be negative. */
export function availableSpending(transactions: readonly Transaction[]): Rupiah {
  return balanceOf(allMovements(transactions), 'personal');
}

export function dailyAllowance(input: {
  available: Rupiah;
  today: DateString;
  paydayDay: number;
  entitlementUnpaid: boolean;
}): DailyAllowance {
  const payday = nextPayday(input.today, input.paydayDay);
  const daysLeft = Math.max(1, daysBetween(input.today, payday));
  const overspent = input.available <= 0;
  return {
    nextPayday: payday,
    daysLeft,
    amount: overspent ? null : Math.floor(input.available / daysLeft),
    overspent,
    salaryDueToday: dayOfMonth(input.today) === input.paydayDay && input.entitlementUnpaid,
  };
}

function salaryPaidInPeriod(transactions: readonly Transaction[], period: string): Rupiah {
  return activeTransactions(transactions)
    .filter((tx) => tx.kind === 'salary_payment' && tx.salaryPeriod === period)
    .reduce((total, tx) => total + tx.amount, 0);
}

function expensesBetween(transactions: readonly Transaction[], from: DateString, to: DateString): Rupiah {
  return activeTransactions(transactions)
    .filter((tx) => tx.kind === 'expense' && tx.date >= from && tx.date <= to)
    .reduce((total, tx) => total + tx.amount, 0);
}

/** The money available at the start of the period: what carried over plus salary paid in it. */
function periodBudget(transactions: readonly Transaction[], today: DateString, paydayDay: number): Rupiah {
  const start = periodStart(today, paydayDay);
  const carriedOver = balanceBefore(allMovements(transactions), 'personal', start);
  return carriedOver + salaryPaidInPeriod(transactions, currentPeriod(today, paydayDay));
}

function elapsedRatio(today: DateString, paydayDay: number): number {
  const start = periodStart(today, paydayDay);
  const length = daysBetween(start, nextPayday(today, paydayDay));
  return Math.min(1, (daysBetween(start, today) + 1) / length);
}

/** How fast this period's money is being spent compared with time; null when there is no budget. */
export function paceStatus(
  transactions: readonly Transaction[],
  today: DateString,
  paydayDay: number,
): Pace | null {
  const budget = periodBudget(transactions, today, paydayDay);
  if (budget <= 0) return null;
  const spent = expensesBetween(transactions, periodStart(today, paydayDay), today);
  const spentRatio = spent / budget;
  const elapsed = elapsedRatio(today, paydayDay);
  return { spentRatio, elapsedRatio: elapsed, ahead: spentRatio - elapsed > CONFIG.PACE_THRESHOLD };
}
