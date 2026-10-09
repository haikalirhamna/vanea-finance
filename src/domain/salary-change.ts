/** Salary history and the rules for each kind of change (SYSTEM-OVERVIEW §5.5). */
import { DateString, Month, addMonths, currentPeriod, monthRange } from './calendar';
import { CONFIG } from './config';
import { Rupiah } from './money';
import { Transaction, activeTransactions } from './ledger';
import { RaiseStatus } from './salary-review';

export type SalaryChangeType = 'initial' | 'calibration' | 'increase' | 'decrease' | 'restore';

export interface SalarySetting {
  amount: Rupiah;
  /** The first salary period the amount applies to. */
  effectivePeriod: Month;
  changeType: SalaryChangeType;
}

/** The review an `increase` must come from. */
export interface ReviewDecisionState {
  status: RaiseStatus;
  maxNewSalary?: Rupiah;
  decision: 'none' | 'accepted' | 'accepted_smaller' | 'declined' | 'expired';
}

export type SalaryChangeErrorCode =
  | 'INVALID_AMOUNT'
  | 'ALREADY_HAS_SALARY'
  | 'CALIBRATION_ENDED'
  | 'NOT_ELIGIBLE'
  | 'ABOVE_MAX_RAISE'
  | 'NOT_AN_INCREASE'
  | 'NOT_A_DECREASE'
  | 'ABOVE_RESTORE_CEILING';

export type SalaryChangeValidation =
  | { ok: true }
  | { ok: false; code: SalaryChangeErrorCode; max?: Rupiah };

export interface SalaryChangeRequest {
  changeType: SalaryChangeType;
  newAmount: Rupiah;
  /** The salary in effect for the period the change would apply to; null before the first one. */
  currentSalary: Rupiah | null;
  period: Month;
  /** Last period in which calibration is allowed. */
  calibrationUntil: Month;
  review?: ReviewDecisionState;
  restoreCeiling: Rupiah | null;
}

const OK: SalaryChangeValidation = { ok: true };
const fail = (code: SalaryChangeErrorCode, max?: Rupiah): SalaryChangeValidation =>
  max === undefined ? { ok: false, code } : { ok: false, code, max };

// ---------------------------------------------------------------------------
// Reading the history
// ---------------------------------------------------------------------------

/** The salary in effect for a period: the latest setting effective on or before it. */
export function salaryFor(settings: readonly SalarySetting[], period: Month): Rupiah | null {
  const applicable = settings.filter((setting) => setting.effectivePeriod <= period);
  if (applicable.length === 0) return null;
  const latest = applicable.reduce((best, s) => (s.effectivePeriod >= best.effectivePeriod ? s : best));
  return latest.amount;
}

const ANCHOR_TYPES: readonly SalaryChangeType[] = ['initial', 'calibration', 'increase'];

/** The period the cooldown counts from: the latest initial, calibration or increase. */
export function anchorPeriod(settings: readonly SalarySetting[]): Month | null {
  const anchors = settings.filter((setting) => ANCHOR_TYPES.includes(setting.changeType));
  if (anchors.length === 0) return null;
  return anchors.map((setting) => setting.effectivePeriod).sort().at(-1)!;
}

/** The highest salary in effect during the last 12 periods, or null before any salary exists. */
export function restoreCeiling(settings: readonly SalarySetting[], period: Month): Rupiah | null {
  const periods = monthRange(addMonths(period, 1 - CONFIG.RESTORE_LOOKBACK_MONTHS), period);
  const salaries = periods.map((p) => salaryFor(settings, p)).filter((s): s is Rupiah => s !== null);
  return salaries.length === 0 ? null : Math.max(...salaries);
}

/** The amount the user may restore to without passing the gates, if above the current salary. */
export function restoreOffer(settings: readonly SalarySetting[], period: Month): Rupiah | null {
  const ceiling = restoreCeiling(settings, period);
  const current = salaryFor(settings, period);
  return ceiling !== null && current !== null && ceiling > current ? ceiling : null;
}

/** The last period of free calibration, counted from the first salary period. */
export function calibrationEnd(firstPeriod: Month): Month {
  return addMonths(firstPeriod, CONFIG.CALIBRATION_PERIODS - 1);
}

/** A change applies to the first salary period that has no payment recorded yet. */
export function firstUnpaidPeriod(
  transactions: readonly Transaction[],
  today: DateString,
  paydayDay: number,
): Month {
  const period = currentPeriod(today, paydayDay);
  const paid = activeTransactions(transactions).some(
    (tx) => tx.kind === 'salary_payment' && tx.salaryPeriod === period,
  );
  return paid ? addMonths(period, 1) : period;
}

// ---------------------------------------------------------------------------
// Validating a change
// ---------------------------------------------------------------------------

function checkInitial(request: SalaryChangeRequest): SalaryChangeValidation {
  return request.currentSalary === null ? OK : fail('ALREADY_HAS_SALARY');
}

function checkCalibration(request: SalaryChangeRequest): SalaryChangeValidation {
  return request.period <= request.calibrationUntil ? OK : fail('CALIBRATION_ENDED');
}

function checkIncrease(request: SalaryChangeRequest): SalaryChangeValidation {
  const { review, newAmount, currentSalary } = request;
  const max = review?.maxNewSalary;
  if (review?.status !== 'ELIGIBLE' || review.decision !== 'none' || max === undefined) {
    return fail('NOT_ELIGIBLE');
  }
  if (currentSalary === null || newAmount <= currentSalary) return fail('NOT_AN_INCREASE');
  return newAmount <= max ? OK : fail('ABOVE_MAX_RAISE', max);
}

function checkDecrease(request: SalaryChangeRequest): SalaryChangeValidation {
  const { currentSalary, newAmount } = request;
  return currentSalary !== null && newAmount < currentSalary ? OK : fail('NOT_A_DECREASE');
}

function checkRestore(request: SalaryChangeRequest): SalaryChangeValidation {
  const { currentSalary, newAmount, restoreCeiling: ceiling } = request;
  if (currentSalary === null || newAmount <= currentSalary) return fail('NOT_AN_INCREASE');
  if (ceiling === null || newAmount > ceiling) return fail('ABOVE_RESTORE_CEILING', ceiling ?? undefined);
  return OK;
}

const CHECK_BY_TYPE: Record<SalaryChangeType, (request: SalaryChangeRequest) => SalaryChangeValidation> = {
  initial: checkInitial,
  calibration: checkCalibration,
  increase: checkIncrease,
  decrease: checkDecrease,
  restore: checkRestore,
};

/** Whether a salary change is allowed. Vanea never changes salary by itself. */
export function validateSalaryChange(request: SalaryChangeRequest): SalaryChangeValidation {
  if (!Number.isSafeInteger(request.newAmount) || request.newAmount <= 0) return fail('INVALID_AMOUNT');
  return CHECK_BY_TYPE[request.changeType](request);
}
