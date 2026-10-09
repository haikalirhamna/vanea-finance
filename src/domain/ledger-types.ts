/** The ledger's vocabulary: accounts, transaction kinds and their fields (SYSTEM-OVERVIEW §6.1, §6.2). */
import { DateString, Month } from './calendar';
import { Rupiah } from './money';

/**
 * Some accounts are scoped by a reference id (`ref_id`, SCHEMA §3.4):
 * `investment` and `investment_cash` by holding, `bill_reserve` by credit line, `debt` by debt.
 */
export const ACCOUNTS = [
  'pool', 'personal', 'savings', 'investment', 'investment_cash', 'bill_reserve', 'debt',
] as const;
export type Account = (typeof ACCOUNTS)[number];

/** Accounts that can be named by an opening balance. */
export const OPENING_ACCOUNTS: readonly Account[] = ['pool', 'personal', 'savings', 'investment', 'debt'];

export const EXPENSE_CATEGORIES = ['needs', 'wants', 'growth', 'unexpected'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const BUSINESS_COST_CATEGORIES = ['subscription', 'tools', 'tax', 'other'] as const;
export type BusinessCostCategory = (typeof BUSINESS_COST_CATEGORIES)[number];

export type BillingCycle = 'monthly' | 'yearly';

/** An expense is paid from Available Spending, with a credit line, or as an installment purchase. */
export type PaymentMethod = 'available' | 'credit_line' | 'installment';

export type DebtCostType = 'interest' | 'fee' | 'late_fee';

export type TransactionKind =
  | 'opening_balance'
  | 'bill_reserve_set_aside'
  | 'income'
  | 'business_cost'
  | 'salary_payment'
  | 'expense'
  | 'debt_cost'
  | 'debt_payment'
  | 'debt_payoff'
  | 'loan_start'
  | 'credit_conversion'
  | 'savings_deposit'
  | 'savings_withdrawal'
  | 'investment_contribution'
  | 'investment_sale'
  | 'investment_income'
  | 'investment_cash_withdrawal'
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
  /** business_cost in the subscription category: how the subscription is billed. */
  billingCycle?: BillingCycle;
  /** expense: how it was paid. debt_*: the kind of debt it touches (credit_line or installment). */
  paymentMethod?: PaymentMethod;
  /** salary_payment only: the salary period `YYYY-MM`. */
  salaryPeriod?: Month;
  /** salary_payment only: part of the salary withheld to repay an advance. */
  advanceInstallment?: Rupiah;
  advanceId?: string;
  /** The credit line or loan a debt transaction (or a credit-line expense) belongs to. */
  debtId?: string;
  /** credit_conversion: the new installment loan. */
  targetDebtId?: string;
  holdingId?: string;
  /** debt_payment and debt_payoff: where the money comes from. */
  sourceAccount?: 'personal' | 'pool';
  /** investment_sale, investment_cash_withdrawal: where the cash goes. loan_start: where the money received goes. */
  destinationAccount?: 'personal' | 'savings' | 'pool';
  /** Credit-line payments and conversions: the part taken from (or returned from) the bill reserve. */
  reservePart?: Rupiah;
  /** investment_sale: the cost (put in) of what was sold. */
  costRemoved?: Rupiah;
  /** debt_payoff: the owed amount that was cleared. */
  clearedAmount?: Rupiah;
  /** loan_start, credit_conversion: the total to repay on the new loan. */
  totalOwed?: Rupiah;
  debtCostType?: DebtCostType;
}

export interface Movement {
  transactionId: string;
  account: Account;
  /** Set for scoped accounts (holding, credit line or debt id). */
  refId?: string;
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
      /** INSUFFICIENT_BALANCE: the holding, credit line or debt it belongs to. */
      refId?: string;
      /** INSUFFICIENT_BALANCE: the first date it goes negative. */
      date?: DateString;
      /** INSUFFICIENT_BALANCE: how far below zero it goes on that date. */
      shortfall?: Rupiah;
    };
