/** The Activity list: every record that still counts, newest first, described in plain words. */
import { DateString } from '@/domain/calendar';
import { activeTransactions } from '@/domain/ledger';
import { Transaction, TransactionKind } from '@/domain/ledger-types';
import { canEdit, canRemove } from '../corrections/corrections-actions';

export type Direction = 'in' | 'out' | 'neutral';

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  direction: Direction;
  date: DateString;
  editable: boolean;
  removable: boolean;
  kind: TransactionKind;
}

const TITLES: Record<TransactionKind, string> = {
  opening_balance: 'Starting balance',
  bill_reserve_set_aside: 'Set aside for a bill',
  income: 'Income',
  business_cost: 'Business cost',
  salary_payment: 'Salary',
  expense: 'Expense',
  debt_cost: 'Cost of borrowing',
  debt_payment: 'Debt payment',
  debt_payoff: 'Loan paid off',
  loan_start: 'Loan started',
  credit_conversion: 'Converted to installments',
  savings_deposit: 'Added to savings',
  savings_withdrawal: 'Taken from savings',
  investment_contribution: 'Put into an investment',
  investment_sale: 'Investment sold',
  investment_income: 'Investment income',
  investment_cash_withdrawal: 'Investment cash taken out',
  surplus_allocation: 'Surplus moved',
  advance_disbursement: 'Salary advance',
  advance_early_repayment: 'Advance repaid early',
  reversal: 'Correction',
};

const DIRECTIONS: Partial<Record<TransactionKind, Direction>> = {
  income: 'in', opening_balance: 'neutral', salary_payment: 'neutral', savings_deposit: 'neutral', savings_withdrawal: 'neutral',
  bill_reserve_set_aside: 'neutral', surplus_allocation: 'neutral',
  business_cost: 'out', expense: 'out', debt_cost: 'out', debt_payment: 'out', debt_payoff: 'out',
};

const CATEGORY_WORDS = { needs: 'Needs', wants: 'Wants', growth: 'Growth', unexpected: 'Unexpected' } as const;

function subtitleOf(tx: Transaction): string {
  const parts: string[] = [];
  if (tx.expenseCategory) parts.push(CATEGORY_WORDS[tx.expenseCategory]);
  if (tx.billingCycle) parts.push(tx.billingCycle === 'yearly' ? 'Yearly' : 'Monthly');
  if (tx.paymentMethod === 'credit_line') parts.push('Credit line');
  if (tx.label && tx.kind !== 'expense') parts.push(tx.label);
  if (tx.note && tx.kind !== 'expense') parts.push(tx.note);
  return parts.join(' · ');
}

const ACCOUNT_NAMES = { pool: 'Pool', personal: 'Available Spending', savings: 'Savings', investment: 'Investments', debt: 'Debt' } as const;

function titleOf(tx: Transaction): string {
  if (tx.kind === 'opening_balance' && tx.account && tx.account in ACCOUNT_NAMES) {
    return `Starting balance · ${ACCOUNT_NAMES[tx.account as keyof typeof ACCOUNT_NAMES]}`;
  }
  if (tx.kind === 'income' && tx.source) return tx.source;
  if (tx.kind === 'business_cost' && tx.label) return tx.label;
  if (tx.kind === 'expense' && tx.note) return tx.note;
  return TITLES[tx.kind];
}

function itemOf(tx: Transaction): ActivityItem {
  return {
    id: tx.id, title: titleOf(tx), subtitle: subtitleOf(tx),
    amount: tx.amount, direction: DIRECTIONS[tx.kind] ?? 'neutral', date: tx.date,
    editable: canEdit(tx.kind), removable: canRemove(tx.kind), kind: tx.kind,
  };
}

export function activityItems(transactions: readonly Transaction[]): ActivityItem[] {
  return activeTransactions(transactions)
    .map(itemOf)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}
