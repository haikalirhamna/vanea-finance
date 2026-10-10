/** Raise review snapshots (SCHEMA §3.9): what the engine saw and what the user decided. */
import { Month } from '@/domain/calendar';
import { RaiseEvaluation, RaiseStatus } from '@/domain/salary-review';
import { SqlDriver } from './driver';
import { Row, fromRow, insertRow, updateRow } from './rows';

export type ReviewDecision = 'none' | 'accepted' | 'accepted_smaller' | 'declined' | 'expired';

export interface EvaluationRecord {
  id: string;
  evaluatedMonth: Month;
  status: RaiseStatus;
  currentSalary: number;
  dataMonths: number;
  referenceIncome?: number;
  /** Ratios stored in basis points (1 = 0.01%). */
  swingBp?: number;
  thresholdBp?: number;
  recentMonthsJson?: string;
  lastYearMonthsJson?: string;
  poolAtEvaluation: number;
  sustainableSalary?: number;
  maxNewSalary?: number;
  decision: ReviewDecision;
  finalSalary?: number;
  decidedAt?: string;
  createdAt: string;
}

const NUMERIC = [
  'currentSalary', 'dataMonths', 'referenceIncome', 'swingBp', 'thresholdBp', 'poolAtEvaluation',
  'sustainableSalary', 'maxNewSalary', 'finalSalary',
];

function evaluationOf(row: Row): EvaluationRecord {
  const record = fromRow<Record<string, string | number>>(row);
  for (const key of NUMERIC) if (key in record) record[key] = Number(record[key]);
  return record as unknown as EvaluationRecord;
}

const toBp = (ratio: number | undefined): number | undefined => (ratio === undefined ? undefined : Math.round(ratio * 10_000));

/** The snapshot to store for an engine evaluation. */
export function recordOf(id: string, month: Month, evaluation: RaiseEvaluation, now: string): EvaluationRecord {
  const e = evaluation.evidence;
  return {
    id, evaluatedMonth: month, status: evaluation.status, currentSalary: e.currentSalary, dataMonths: e.dataMonths,
    ...(e.referenceIncome !== undefined ? { referenceIncome: Math.round(e.referenceIncome) } : {}),
    ...(e.swing !== undefined ? { swingBp: toBp(e.swing)! } : {}),
    ...(e.threshold !== undefined ? { thresholdBp: toBp(e.threshold)! } : {}),
    ...(e.recent ? { recentMonthsJson: JSON.stringify(e.recent) } : {}),
    ...(e.sameMonthsLastYear ? { lastYearMonthsJson: JSON.stringify(e.sameMonthsLastYear) } : {}),
    poolAtEvaluation: e.pool,
    ...(e.sustainableSalary !== undefined ? { sustainableSalary: Math.round(e.sustainableSalary) } : {}),
    ...(evaluation.maxNewSalary !== undefined ? { maxNewSalary: evaluation.maxNewSalary } : {}),
    decision: 'none', createdAt: now,
  };
}

/** Newest first. */
export async function loadEvaluations(driver: SqlDriver): Promise<EvaluationRecord[]> {
  return (await driver.all('SELECT * FROM salary_evaluations ORDER BY evaluated_month DESC, created_at DESC, rowid DESC')).map(evaluationOf);
}

export async function insertEvaluation(driver: SqlDriver, record: EvaluationRecord): Promise<void> {
  await insertRow(driver, 'salary_evaluations', record);
}

export async function decideEvaluation(
  driver: SqlDriver, id: string, decision: Exclude<ReviewDecision, 'none'>, finalSalary: number | undefined, now: string,
): Promise<void> {
  await updateRow(driver, 'salary_evaluations', id, { decision, ...(finalSalary === undefined ? {} : { finalSalary }), decidedAt: now });
}

/** Undecided reviews from months before `month` can no longer be acted on. */
export async function expireBefore(driver: SqlDriver, month: Month, now: string): Promise<void> {
  await driver.run(
    "UPDATE salary_evaluations SET decision = 'expired', decided_at = ? WHERE decision = 'none' AND status = 'ELIGIBLE' AND evaluated_month < ?",
    [now, month],
  );
}
