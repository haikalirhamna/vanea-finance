/** What the Salary tab needs to know about raises, decreases and restoring (PRD SAL-4..7, SAL-9). Pure. */
import { DateString, Month, currentPeriod, monthOf } from '@/domain/calendar';
import { netIncomeSeries } from '@/domain/income-history';
import { RaiseEvaluation, evaluateRaise } from '@/domain/salary-review';
import { anchorPeriod, firstUnpaidPeriod, restoreOffer, salaryFor } from '@/domain/salary-change';
import { runwayMonths } from '@/domain/pool';
import { loansOf } from '@/data/debts';
import { EvaluationRecord } from '@/data/salary-evaluations';
import { Snapshot } from '@/data/snapshot';
import { poolSummary } from '../dashboard/dashboard-summary';
import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';

/** Runs the five gates on today's data. Null before the first salary exists. */
export function evaluateToday(snapshot: Snapshot, today: DateString): RaiseEvaluation | null {
  const profile = snapshot.profile!;
  const period = currentPeriod(today, profile.paydayDay);
  const salary = salaryFor(snapshot.salarySettings, period);
  const anchor = anchorPeriod(snapshot.salarySettings);
  if (salary === null || anchor === null) return null;
  const series = netIncomeSeries(snapshot.transactions, snapshot.historicalMonths, today, loansOf(snapshot.debts));
  const pool = poolSummary(snapshot, today, salary, balanceOf(allMovements(snapshot.transactions), 'pool')).own;
  return evaluateRaise({ series, currentSalary: salary, pool, anchorPeriod: anchor });
}

/** The review stored for this calendar month, if any. */
export function reviewForMonth(snapshot: Snapshot, month: Month): EvaluationRecord | null {
  return snapshot.evaluations.find((e) => e.evaluatedMonth === month) ?? null;
}

export interface SalaryOptions {
  /** The period a change would apply to. */
  period: Month;
  salary: number | null;
  /** An eligible, undecided review for this month. */
  review: EvaluationRecord | null;
  /** The status of this month's review, decided or not (for the "not yet" explanation). */
  status: EvaluationRecord | null;
  /** Return to this amount without gates, if above the current salary. */
  restoreTo: number | null;
}

/** Changes apply to the first unpaid period, but never before the first salary period itself. */
export function changePeriod(snapshot: Snapshot, today: DateString): Month {
  const unpaid = firstUnpaidPeriod(snapshot.transactions, today, snapshot.profile!.paydayDay);
  const first = snapshot.salarySettings[0]?.effectivePeriod;
  return first !== undefined && first > unpaid ? first : unpaid;
}

export function salaryOptions(snapshot: Snapshot, today: DateString): SalaryOptions {
  const period = changePeriod(snapshot, today);
  const status = reviewForMonth(snapshot, monthOf(today));
  const open = status && status.status === 'ELIGIBLE' && status.decision === 'none' ? status : null;
  return {
    period, salary: salaryFor(snapshot.salarySettings, period), review: open, status,
    restoreTo: restoreOffer(snapshot.salarySettings, period),
  };
}

export interface ChangePreview {
  runwayBefore: number | null;
  runwayAfter: number | null;
  monthlyCommitmentAfter: number;
}

/** How a new salary would change how long the Pool lasts (PRD SAL-6). */
export function previewSalaryChange(snapshot: Snapshot, today: DateString, newSalary: number): ChangePreview {
  const balance = balanceOf(allMovements(snapshot.transactions), 'pool');
  const current = salaryFor(snapshot.salarySettings, changePeriod(snapshot, today));
  const before = poolSummary(snapshot, today, current, balance);
  const after = poolSummary(snapshot, today, newSalary, balance);
  return {
    runwayBefore: before.runwayMonths,
    runwayAfter: runwayMonths(after.own, after.commitment),
    monthlyCommitmentAfter: after.commitment,
  };
}

export interface SalaryHistoryItem {
  id: string;
  period: Month;
  amount: number;
  type: 'initial' | 'calibration' | 'increase' | 'decrease' | 'restore';
}

/** Every salary change, newest first (PRD SAL-9). */
export function salaryHistory(snapshot: Snapshot): SalaryHistoryItem[] {
  return [...snapshot.salarySettings]
    .map((s) => ({ id: s.id, period: s.effectivePeriod, amount: s.amount, type: s.changeType }))
    .reverse();
}
