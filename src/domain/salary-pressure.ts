/** Salary pressure: a calm, explainable warning when salary outpaces income (SYSTEM-OVERVIEW §5.6). */
import { CONFIG } from './config';
import { Rupiah } from './money';
import { runwayMonths } from './pool';
import { recommendSalary } from './salary-recommendation';
import { median } from './statistics';

export type PressureLevel = 'NONE' | 'THIN_BUFFER' | 'INFO' | 'ATTENTION' | 'SERIOUS';

export interface SalaryPressure {
  level: PressureLevel;
  runwayMonths: number | null;
  /** Median net income of the last 3 completed months; null with less data. */
  typicalIncome: number | null;
  /** How long the Pool lasts if the gap between salary and typical income continues. */
  monthsToEmpty: number | null;
  /** ATTENTION and SERIOUS only, and only when below the current salary. */
  safeSalary: Rupiah | null;
}

export interface PressureInput {
  /** Net income of completed months, oldest first. */
  amounts: readonly number[];
  salary: Rupiah;
  pool: Rupiah;
  /** Salary plus recurring costs per month (see pool.monthlyCommitment). */
  commitment: Rupiah;
}

const RECENT_MONTHS_FOR_PRESSURE = 3;

function levelWhenSalaryExceedsIncome(monthsToEmpty: number): PressureLevel {
  if (monthsToEmpty <= CONFIG.PRESSURE_SERIOUS_MONTHS) return 'SERIOUS';
  if (monthsToEmpty <= CONFIG.PRESSURE_ATTENTION_MONTHS) return 'ATTENTION';
  return 'INFO';
}

function levelWhenIncomeCoversSalary(runway: number | null): PressureLevel {
  return runway !== null && runway < 1 ? 'THIN_BUFFER' : 'NONE';
}

function safeSalaryBelow(amounts: readonly number[], pool: Rupiah, salary: Rupiah): Rupiah | null {
  const recommended = recommendSalary(amounts, pool);
  return recommended !== null && recommended.amount < salary ? recommended.amount : null;
}

export function assessPressure(input: PressureInput): SalaryPressure {
  const runway = runwayMonths(input.pool, input.commitment);
  const base = { runwayMonths: runway, typicalIncome: null, monthsToEmpty: null, safeSalary: null };
  if (input.amounts.length < RECENT_MONTHS_FOR_PRESSURE) return { level: 'NONE', ...base };

  const typicalIncome = median(input.amounts.slice(-RECENT_MONTHS_FOR_PRESSURE));
  if (input.salary <= typicalIncome) {
    return { level: levelWhenIncomeCoversSalary(runway), ...base, typicalIncome };
  }
  const monthsToEmpty = input.pool / (input.salary - typicalIncome);
  const level = levelWhenSalaryExceedsIncome(monthsToEmpty);
  const needsSafeSalary = level === 'ATTENTION' || level === 'SERIOUS';
  const safeSalary = needsSafeSalary ? safeSalaryBelow(input.amounts, input.pool, input.salary) : null;
  return { level, runwayMonths: runway, typicalIncome, monthsToEmpty, safeSalary };
}
