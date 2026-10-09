/** Where this payday stands: the salary in effect, any advance being repaid, and what is left to pay. */
import { DateString, Month, currentPeriod } from '@/domain/calendar';
import { Transaction } from '@/domain/ledger-types';
import { SalaryAdvance, outstandingOf } from '@/domain/salary-advance';
import { salaryFor } from '@/domain/salary-change';
import { AdvanceTerms, PeriodPayment, periodPayment } from '@/domain/salary-payment';
import { AdvanceRecord } from '@/data/salary';
import { Snapshot } from '@/data/snapshot';

export interface ActiveAdvance {
  record: AdvanceRecord;
  outstanding: number;
}

export interface SalaryState {
  period: Month;
  /** Null until the first salary period starts (the first payday has not come yet). */
  salary: number | null;
  /** Null when there is no salary for this period. */
  payment: PeriodPayment | null;
  advance: ActiveAdvance | null;
}

function domainAdvance(record: AdvanceRecord): SalaryAdvance {
  const { id, amount, termPeriods, installmentAmount, firstPeriod } = record;
  return { id, amount, termPeriods, installmentAmount, firstPeriod };
}

export function activeAdvanceOf(advances: readonly AdvanceRecord[], transactions: readonly Transaction[]): ActiveAdvance | null {
  const record = advances.find((a) => a.status === 'active');
  return record ? { record, outstanding: outstandingOf(domainAdvance(record), transactions) } : null;
}

function termsOf(advance: ActiveAdvance | null): AdvanceTerms | null {
  if (!advance) return null;
  const { firstPeriod, installmentAmount } = advance.record;
  return { firstPeriod, installmentAmount, outstanding: advance.outstanding };
}

export function salaryState(snapshot: Pick<Snapshot, 'profile' | 'salarySettings' | 'transactions' | 'advances'>, today: DateString): SalaryState {
  const profile = snapshot.profile!;
  const period = currentPeriod(today, profile.paydayDay);
  const salary = salaryFor(snapshot.salarySettings, period);
  const advance = activeAdvanceOf(snapshot.advances, snapshot.transactions);
  const payment = salary === null ? null : periodPayment({ salary, period, transactions: snapshot.transactions, advance: termsOf(advance) });
  return { period, salary, payment, advance };
}

/** True when this period still has salary to pay (or a withheld installment to settle). */
export function salaryIsDue(state: SalaryState): boolean {
  const payment = state.payment;
  if (!payment) return false;
  return payment.remaining > 0 || (!payment.hasPayment && payment.installmentWithheld > 0);
}
