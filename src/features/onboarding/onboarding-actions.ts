/** First launch: everything the profile needs, written together (PRD §8.1, USER-FLOWS §1). */
import { DateString, Month, dayOfMonth, monthOf, nextPayday } from '@/domain/calendar';
import { CONFIG } from '@/domain/config';
import { HistoricalMonth } from '@/domain/income-history';
import { Transaction } from '@/domain/ledger-types';
import { calibrationEnd } from '@/domain/salary-change';
import { CreditLineType, DebtRecord, LoanType, insertDebt } from '@/data/debts';
import { getProfile, insertProfile } from '@/data/profile';
import { replaceHistoricalMonths } from '@/data/planning';
import { insertSalarySetting } from '@/data/salary';
import { LoanPurpose } from '@/domain/installment-loans';
import { ActionContext, ActionResult, failure, runAtomic, writeBatch } from '../action-runtime';
import { problem } from '../errors';
import { recommendForOnboarding } from './onboarding-recommendation';

export interface OnboardingCreditLine {
  kind: 'credit_line';
  name: string;
  type: CreditLineType;
  statementDay: number;
  dueDay: number;
  creditLimit?: number;
  /** What is owed today. */
  balance: number;
  /** Take the balance out of Available Spending now (the default), or treat it as older debt. */
  setAside: boolean;
}

export interface OnboardingLoan {
  kind: 'installment_loan';
  name: string;
  type: LoanType;
  purpose: LoanPurpose;
  installmentAmount: number;
  remainingInstallments: number;
  nextDueDate: DateString;
}

export type OnboardingDebt = OnboardingCreditLine | OnboardingLoan;

export interface OnboardingInput {
  displayName?: string;
  paydayDay: number;
  /** Net income per month, after business costs. May include the current month's part so far. */
  historical: readonly HistoricalMonth[];
  openingBalances: { pool: number; personal: number; savings: number };
  debts: readonly OnboardingDebt[];
  salary: number;
}

/** The first salary period Vanea will pay: today's when it is payday, otherwise the next payday's. */
export function firstSalaryPeriod(today: DateString, paydayDay: number): Month {
  return dayOfMonth(today) === paydayDay ? monthOf(today) : monthOf(nextPayday(today, paydayDay));
}

function validate(input: OnboardingInput): ActionResult | null {
  if (!Number.isInteger(input.paydayDay) || input.paydayDay < CONFIG.PAYDAY_MIN || input.paydayDay > CONFIG.PAYDAY_MAX) {
    return failure(problem('Pick a payday from 1 to 28', 'Paydays after the 28th do not exist in every month.', 'Choose a day between 1 and 28.'));
  }
  if (!Number.isSafeInteger(input.salary) || input.salary <= 0) {
    return failure(problem('Choose a salary', 'Your salary has to be a whole number of rupiah above zero.', 'Enter the salary you want to pay yourself.'));
  }
  const balances = Object.values(input.openingBalances);
  if (balances.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return failure(problem('Check your current money', 'Amounts cannot be negative.', 'Enter 0 where you have nothing.'));
  }
  return null;
}

function openingTransactions(ctx: ActionContext, input: OnboardingInput): Transaction[] {
  const make = (account: 'pool' | 'personal' | 'savings', amount: number): Transaction[] =>
    amount > 0 ? [{ id: ctx.newId(), kind: 'opening_balance', date: ctx.today(), amount, account }] : [];
  const { pool, personal, savings } = input.openingBalances;
  return [...make('pool', pool), ...make('personal', personal), ...make('savings', savings)];
}

function creditLineRecord(ctx: ActionContext, debt: OnboardingCreditLine): DebtRecord {
  return {
    id: ctx.newId(), kind: 'credit_line', name: debt.name, type: debt.type, purpose: 'personal',
    statementDay: debt.statementDay, dueDay: debt.dueDay,
    ...(debt.creditLimit ? { creditLimit: debt.creditLimit } : {}), origin: 'onboarding', status: 'open',
  };
}

function loanRecord(ctx: ActionContext, debt: OnboardingLoan): DebtRecord {
  const owed = debt.installmentAmount * debt.remainingInstallments;
  return {
    id: ctx.newId(), kind: 'installment_loan', name: debt.name, type: debt.type, purpose: debt.purpose,
    amountReceived: owed, installmentAmount: debt.installmentAmount, installmentCount: debt.remainingInstallments,
    frequency: 'monthly', startDate: ctx.today(), firstDueDate: debt.nextDueDate, origin: 'onboarding', status: 'open',
  };
}

function debtOpening(ctx: ActionContext, record: DebtRecord, amount: number, setAside: boolean): Transaction[] {
  if (amount <= 0) return [];
  const base = { date: ctx.today(), debtId: record.id };
  const owed: Transaction = { id: ctx.newId(), kind: 'opening_balance', amount, account: 'debt', ...base };
  const reserve: Transaction = { id: ctx.newId(), kind: 'bill_reserve_set_aside', amount, ...base };
  return setAside ? [owed, reserve] : [owed];
}

interface DebtPlan {
  records: DebtRecord[];
  transactions: Transaction[];
}

function planDebts(ctx: ActionContext, debts: readonly OnboardingDebt[]): DebtPlan {
  const plan: DebtPlan = { records: [], transactions: [] };
  for (const debt of debts) {
    const record = debt.kind === 'credit_line' ? creditLineRecord(ctx, debt) : loanRecord(ctx, debt);
    const amount = debt.kind === 'credit_line' ? debt.balance : debt.installmentAmount * debt.remainingInstallments;
    plan.records.push(record);
    plan.transactions.push(...debtOpening(ctx, record, amount, debt.kind === 'credit_line' ? debt.setAside : false));
  }
  return plan;
}

/** Writes the profile, history, opening balances, debts and the first salary. Nothing is half-saved. */
export async function completeOnboarding(ctx: ActionContext, input: OnboardingInput): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return invalid;
  const today = ctx.today();
  const firstPeriod = firstSalaryPeriod(today, input.paydayDay);
  const debts = planDebts(ctx, input.debts);
  const { recommendation } = recommendForOnboarding(input.historical, input.openingBalances.pool, today);

  return runAtomic(ctx, async () => {
    if (await getProfile(ctx.driver)) {
      return failure(problem('Already set up', 'Vanea already has a profile on this phone.', 'Use Settings to change it.'));
    }
    const now = ctx.now();
    await insertProfile(ctx.driver, {
      id: ctx.newId(), ...(input.displayName ? { displayName: input.displayName } : {}), paydayDay: input.paydayDay,
      onboardedOn: today, calibrationUntilPeriod: calibrationEnd(firstPeriod), bufferMonths: CONFIG.DEFAULT_BUFFER_MONTHS,
      appLockEnabled: true, createdAt: now, updatedAt: now,
      notify: { payday: true, subscriptions: true, debts: true, month: true, pressure: true, backup: true },
    });
    await replaceHistoricalMonths(ctx.driver, input.historical, now);
    for (const record of debts.records) await insertDebt(ctx.driver, record, now);
    await insertSalarySetting(ctx.driver, {
      id: ctx.newId(), amount: input.salary, effectivePeriod: firstPeriod, changeType: 'initial',
      ...(recommendation ? { recommendedAmount: recommendation.amount } : {}), createdAt: now,
    });
    return writeBatch(ctx, [...openingTransactions(ctx, input), ...debts.transactions]);
  });
}
