/** Raise eligibility: the five gates (SYSTEM-OVERVIEW §5.4). */
import { Month, addMonths } from './calendar';
import { CONFIG } from './config';
import { MonthlyNetIncome, amountsOf } from './income-history';
import { Rupiah, floorToStep, percentOf } from './money';
import { sustainableSalary } from './salary-recommendation';
import { median, usualSwing } from './statistics';

export type RaiseStatus =
  | 'INSUFFICIENT_DATA'
  | 'COOLDOWN'
  | 'OBSERVING'
  | 'SEASONAL_PATTERN'
  | 'NOT_AFFORDABLE'
  | 'ELIGIBLE';

export interface RaiseInput {
  /** Completed months, oldest first, contiguous. */
  series: readonly MonthlyNetIncome[];
  currentSalary: Rupiah;
  pool: Rupiah;
  /** Effective period of the latest initial, calibration or increase setting. */
  anchorPeriod: Month;
}

/** What the user is shown, and what a salary evaluation snapshot stores (SCHEMA §3.9). */
export interface RaiseEvidence {
  dataMonths: number;
  currentSalary: Rupiah;
  pool: Rupiah;
  recent?: MonthlyNetIncome[];
  referenceIncome?: number;
  swing?: number;
  threshold?: number;
  /** The lowest amount each recent month must reach. */
  requiredPerMonth?: number;
  sameMonthsLastYear?: MonthlyNetIncome[];
  sustainableSalary?: number;
}

export interface RaiseEvaluation {
  status: RaiseStatus;
  evidence: RaiseEvidence;
  /** ELIGIBLE only. */
  maxRaise?: Rupiah;
  maxNewSalary?: Rupiah;
}

interface Context {
  input: RaiseInput;
  recent: MonthlyNetIncome[];
  referenceWindow: number[];
  referenceIncome: number;
  swing: number;
  threshold: number;
  evidence: RaiseEvidence;
}

function buildContext(input: RaiseInput): Context {
  const { series } = input;
  const recent = series.slice(-CONFIG.RECENT_MONTHS);
  const referenceWindow = amountsOf(series.slice(0, -CONFIG.RECENT_MONTHS)).slice(-CONFIG.REFERENCE_MAX_MONTHS);
  const referenceIncome = median(referenceWindow);
  const swing = usualSwing(referenceWindow);
  const threshold = Math.max(CONFIG.MIN_SHIFT, CONFIG.SWING_MULTIPLIER * swing);
  const evidence: RaiseEvidence = {
    dataMonths: series.length,
    currentSalary: input.currentSalary,
    pool: input.pool,
    recent,
    referenceIncome,
    swing,
    threshold,
    requiredPerMonth: referenceIncome * (1 + threshold),
  };
  return { input, recent, referenceWindow, referenceIncome, swing, threshold, evidence };
}

function result(status: RaiseStatus, evidence: RaiseEvidence): RaiseEvaluation {
  return { status, evidence };
}

/** Gate 1 — at least 6 completed months of data. */
function hasEnoughData(input: RaiseInput): boolean {
  return input.series.length >= CONFIG.MIN_DATA_MONTHS;
}

/** Gate 2 — three full months have passed at the current salary. */
function checkCooldown(ctx: Context): RaiseEvaluation | null {
  const oldestRecent = ctx.recent[0]!;
  return oldestRecent.month >= ctx.input.anchorPeriod ? null : result('COOLDOWN', ctx.evidence);
}

/** Gate 3 — every recent month, not just the median, cleared the required level. */
function checkRealShift(ctx: Context): RaiseEvaluation | null {
  const lowest = Math.min(...amountsOf(ctx.recent));
  return lowest >= ctx.referenceIncome * (1 + ctx.threshold) ? null : result('OBSERVING', ctx.evidence);
}

/** Gate 4 — the rise is not just last year's seasonal pattern (needs a year of data). */
function checkNotSeasonal(ctx: Context): RaiseEvaluation | null {
  const { series } = ctx.input;
  if (series.length < 12 + CONFIG.RECENT_MONTHS) return null;
  const lastYear = series.slice(-12 - CONFIG.RECENT_MONTHS, -12);
  const evidence = { ...ctx.evidence, sameMonthsLastYear: lastYear };
  const grew = median(amountsOf(ctx.recent)) >= (1 + CONFIG.MIN_SHIFT) * median(amountsOf(lastYear));
  return grew ? null : result('SEASONAL_PATTERN', evidence);
}

/** Gate 5 — the Pool can sustain a full 5% raise through the weakest months. */
function checkAffordable(ctx: Context): RaiseEvaluation | null {
  const { input } = ctx;
  const sustainable = sustainableSalary(amountsOf(input.series), input.pool);
  const evidence = { ...ctx.evidence, sustainableSalary: sustainable };
  const affordable = sustainable >= input.currentSalary * (1 + CONFIG.MAX_RAISE_PERCENT / 100);
  return affordable ? null : result('NOT_AFFORDABLE', evidence);
}

/** The largest raise: 5% of the current salary, rounded down to Rp 10.000. */
export function maxRaiseFor(salary: Rupiah): Rupiah {
  return floorToStep(percentOf(salary, CONFIG.MAX_RAISE_PERCENT), CONFIG.RAISE_ROUNDING);
}

function eligible(ctx: Context): RaiseEvaluation {
  const { currentSalary, series, pool } = ctx.input;
  const evidence = { ...ctx.evidence, sustainableSalary: sustainableSalary(amountsOf(series), pool) };
  const maxRaise = maxRaiseFor(currentSalary);
  return { status: 'ELIGIBLE', evidence, maxRaise, maxNewSalary: currentSalary + maxRaise };
}

/** Runs the five gates in order; the first failing gate decides the status. */
export function evaluateRaise(input: RaiseInput): RaiseEvaluation {
  if (!hasEnoughData(input)) {
    const evidence = { dataMonths: input.series.length, currentSalary: input.currentSalary, pool: input.pool };
    return result('INSUFFICIENT_DATA', evidence);
  }
  const ctx = buildContext(input);
  return (
    checkCooldown(ctx) ??
    checkRealShift(ctx) ??
    checkNotSeasonal(ctx) ??
    checkAffordable(ctx) ??
    eligible(ctx)
  );
}

/** The anchor implied by "months since the last change" (used by the simulation parity harness). */
export function anchorFromMonthsSince(lastMonth: Month, monthsSinceChange: number): Month {
  return addMonths(lastMonth, 1 - monthsSinceChange);
}
