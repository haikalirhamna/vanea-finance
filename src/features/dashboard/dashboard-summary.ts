/**
 * Everything the home screen shows, computed from the stored records with the domain rules.
 * Pure: the screen only formats these values (UI holds no financial rules).
 */
import { DateString, Month, nextPayday } from '@/domain/calendar';
import { dueBeforePayday, dueInMonth, debtPaymentRatio, exceedsDebtRatio, totalOwed, DebtBook } from '@/domain/debts';
import { amountsOf, netIncomeSeries } from '@/domain/income-history';
import { businessLoanCommitment, businessPrincipalOwed } from '@/domain/installment-loans';
import { activeTransactions, balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { ExpenseCategory, Transaction } from '@/domain/ledger-types';
import { monthlyCommitment, ownPool, runwayMonths } from '@/domain/pool';
import { SalaryPressure, assessPressure } from '@/domain/salary-pressure';
import { DailyAllowance, Pace, availableSpending, dailyAllowance, paceStatus } from '@/domain/spending';
import { monthlyEquivalents } from '@/domain/subscriptions';
import { creditLinesOf, loansOf } from '@/data/debts';
import { Snapshot } from '@/data/snapshot';
import { periodsRemaining } from '@/domain/salary-advance';
import { maxPaymentNow } from '@/domain/salary-payment';
import { salaryIsDue, salaryState } from '../salary/salary-state';

export interface RecentSpending {
  id: string;
  label: string;
  category: ExpenseCategory;
  amount: number;
  date: DateString;
  paidWithCreditLine: boolean;
}

export interface SalarySummary {
  /** The salary in effect this period; null before the first salary period. */
  amount: number | null;
  period: Month;
  nextPayday: DateString;
  /** The first salary period starts on this date, when there is no salary yet. */
  startsOn: DateString | null;
  due: boolean;
  /** What is left to pay this period. */
  remaining: number;
  /** What can be paid right now: what is left, limited by the Pool. */
  payableNow: number;
  /** Withheld from this period's salary to repay a salary advance. */
  withheld: number;
  /** The active salary advance, if any. */
  advance: { outstanding: number; installment: number; periodsLeft: number } | null;
}

export interface DebtSummary {
  totalOwed: number;
  dueBeforePayday: number;
  dueThisMonth: number;
  ratio: number | null;
  showRatioCard: boolean;
}

export interface DashboardSummary {
  today: DateString;
  availableSpending: number;
  allowance: DailyAllowance;
  pace: Pace | null;
  salary: SalarySummary;
  pool: { balance: number; own: number; runwayMonths: number | null; commitment: number };
  pressure: SalaryPressure;
  recentSpending: RecentSpending[];
  debts: DebtSummary;
}

const RECENT_COUNT = 5;

export function debtBookOf(snapshot: Snapshot): DebtBook {
  return { loans: loansOf(snapshot.debts), lines: creditLinesOf(snapshot.debts), transactions: snapshot.transactions };
}

function recentSpendingOf(transactions: readonly Transaction[]): RecentSpending[] {
  return activeTransactions(transactions)
    .filter((tx) => tx.kind === 'expense' && tx.expenseCategory !== undefined)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .slice(0, RECENT_COUNT)
    .map((tx) => ({
      id: tx.id, label: tx.note ?? tx.label ?? 'Expense', category: tx.expenseCategory!, amount: tx.amount, date: tx.date,
      paidWithCreditLine: tx.paymentMethod === 'credit_line',
    }));
}

function salarySummary(snapshot: Snapshot, today: DateString, pool: number): SalarySummary {
  const state = salaryState(snapshot, today);
  const profile = snapshot.profile!;
  const payment = state.payment;
  const firstPeriod = snapshot.salarySettings[0]?.effectivePeriod;
  return {
    amount: state.salary,
    period: state.period,
    nextPayday: nextPayday(today, profile.paydayDay),
    startsOn: state.salary === null && firstPeriod ? `${firstPeriod}-${String(profile.paydayDay).padStart(2, '0')}` : null,
    due: salaryIsDue(state),
    remaining: payment?.remaining ?? 0,
    payableNow: payment ? maxPaymentNow(payment, pool) : 0,
    withheld: payment?.installmentWithheld ?? 0,
    advance: state.advance
      ? { outstanding: state.advance.outstanding, installment: state.advance.record.installmentAmount, periodsLeft: periodsRemaining(state.advance.record, state.advance.outstanding) }
      : null,
  };
}

export function poolSummary(snapshot: Snapshot, today: DateString, salary: number | null, balance: number) {
  const own = ownPool(balance, businessPrincipalOwed(loansOf(snapshot.debts), snapshot.transactions));
  const costs = [
    ...monthlyEquivalents(snapshot.subscriptions, today),
    businessLoanCommitment(loansOf(snapshot.debts), snapshot.transactions),
  ];
  const commitment = monthlyCommitment(salary ?? 0, costs);
  return { balance, own, runwayMonths: runwayMonths(own, commitment), commitment };
}

function debtSummary(book: DebtBook, today: DateString, paydayDay: number, salary: number | null): DebtSummary {
  const dueThisMonth = dueInMonth(book, today.slice(0, 7), today);
  const ratio = debtPaymentRatio(dueThisMonth, salary ?? 0);
  return {
    totalOwed: totalOwed(book),
    dueBeforePayday: dueBeforePayday(book, today, nextPayday(today, paydayDay)),
    dueThisMonth,
    ratio,
    showRatioCard: exceedsDebtRatio(ratio),
  };
}

export function buildDashboard(snapshot: Snapshot, today: DateString): DashboardSummary {
  const profile = snapshot.profile!;
  const movements = allMovements(snapshot.transactions);
  const balance = balanceOf(movements, 'pool');
  const salary = salarySummary(snapshot, today, balance);
  const pool = poolSummary(snapshot, today, salary.amount, balance);
  const debts = debtSummary(debtBookOf(snapshot), today, profile.paydayDay, salary.amount);
  const available = availableSpending(snapshot.transactions);
  const series = netIncomeSeries(snapshot.transactions, snapshot.historicalMonths, today, loansOf(snapshot.debts));
  return {
    today,
    availableSpending: available,
    allowance: dailyAllowance({
      available, today, paydayDay: profile.paydayDay, entitlementUnpaid: salary.due, dueBeforePayday: debts.dueBeforePayday,
    }),
    pace: paceStatus(snapshot.transactions, today, profile.paydayDay),
    salary,
    pool,
    pressure: assessPressure({ amounts: amountsOf(series), salary: salary.amount ?? 0, pool: pool.own, commitment: pool.commitment }),
    recentSpending: recentSpendingOf(snapshot.transactions),
    debts,
  };
}
