/** Monthly net income: the series the salary engine works on (SYSTEM-OVERVIEW §5.2). */
import { DateString, Month, lastCompletedMonth, monthOf, monthRange } from './calendar';
import { InstallmentLoan, businessLoanCostsByMonth } from './installment-loans';
import { Transaction, activeTransactions } from './ledger';
import { Rupiah } from './money';
import { spreadCharge } from './subscriptions';

export interface HistoricalMonth {
  month: Month;
  amount: Rupiah;
}

export interface MonthlyNetIncome {
  month: Month;
  /** Income minus business costs; may be negative in a month of heavy costs. */
  amount: number;
}

function addToMonth(totals: Map<Month, number>, month: Month, amount: number): void {
  totals.set(month, (totals.get(month) ?? 0) + amount);
}

/** A business cost belongs to the month paid, except a yearly subscription, which is spread over 12 months. */
function addBusinessCost(totals: Map<Month, number>, tx: Transaction): void {
  const paidMonth = monthOf(tx.date);
  const isYearlySubscription = tx.businessCostCategory === 'subscription' && tx.billingCycle === 'yearly';
  if (!isYearlySubscription) return addToMonth(totals, paidMonth, -tx.amount);
  for (const share of spreadCharge(tx.amount, 'yearly', paidMonth)) addToMonth(totals, share.month, -share.amount);
}

/**
 * Only income and business costs count. Loan money received, investment income and sale proceeds,
 * opening balances and transfers between the user's own accounts never do.
 */
function monthlyTotals(
  transactions: readonly Transaction[],
  historical: readonly HistoricalMonth[],
  businessLoans: readonly InstallmentLoan[],
): Map<Month, number> {
  const totals = new Map<Month, number>();
  for (const entry of historical) addToMonth(totals, entry.month, entry.amount);
  for (const tx of activeTransactions(transactions)) {
    if (tx.kind === 'income') addToMonth(totals, monthOf(tx.date), tx.amount);
    if (tx.kind === 'business_cost') addBusinessCost(totals, tx);
  }
  for (const [month, cost] of businessLoanCostsByMonth(businessLoans, transactions)) addToMonth(totals, month, -cost);
  return totals;
}

/**
 * Net income for every completed month, from the earliest month with data.
 * Months inside that span without records count as 0: a quiet month is information.
 * Reversed income and costs are excluded together with their reversal.
 */
export function netIncomeSeries(
  transactions: readonly Transaction[],
  historical: readonly HistoricalMonth[],
  today: DateString,
  businessLoans: readonly InstallmentLoan[] = [],
): MonthlyNetIncome[] {
  const totals = monthlyTotals(transactions, historical, businessLoans);
  if (totals.size === 0) return [];
  const earliest = [...totals.keys()].sort()[0]!;
  return monthRange(earliest, lastCompletedMonth(today)).map((month) => ({
    month,
    amount: totals.get(month) ?? 0,
  }));
}

export function amountsOf(series: readonly MonthlyNetIncome[]): number[] {
  return series.map((entry) => entry.amount);
}
