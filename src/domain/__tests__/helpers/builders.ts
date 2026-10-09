import { DateString, Month } from '../../calendar';
import { Account, ExpenseCategory, LedgerRules, Transaction, TransactionKind } from '../../ledger';

export const RULES: LedgerRules = { today: '2026-10-09', onboardedOn: '2026-01-01' };

let counter = 0;

export function tx(kind: TransactionKind, amount: number, extra: Partial<Transaction> = {}): Transaction {
  counter += 1;
  return { id: `t${counter}`, kind, amount, date: '2026-01-15', ...extra };
}

export const opening = (account: Account, amount: number, date: DateString = '2026-01-01') =>
  tx('opening_balance', amount, { account, date });

export const income = (amount: number, date: DateString = '2026-01-15') => tx('income', amount, { date });

export const businessCost = (amount: number, date: DateString = '2026-01-15') =>
  tx('business_cost', amount, { date, businessCostCategory: 'subscription' });

export const expense = (amount: number, date: DateString, category: ExpenseCategory = 'needs') =>
  tx('expense', amount, { date, expenseCategory: category });

export const salaryPayment = (amount: number, period: Month, date: DateString, installment = 0, advanceId?: string) =>
  tx('salary_payment', amount, {
    date,
    salaryPeriod: period,
    advanceInstallment: installment,
    ...(advanceId ? { advanceId } : {}),
  });

export const reversalOf = (original: Transaction, date: DateString, amount?: number): Transaction =>
  tx('reversal', amount ?? original.amount, { date, reversesId: original.id });

/** Builds a contiguous monthly series starting at `start`. */
export function series(start: Month, amounts: number[]): { month: Month; amount: number }[] {
  const [year, month] = start.split('-').map(Number) as [number, number];
  return amounts.map((amount, index) => {
    const total = year * 12 + (month - 1) + index;
    return { month: `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`, amount };
  });
}

export const million = (...values: number[]): number[] => values.map((value) => Math.round(value * 1_000_000));
