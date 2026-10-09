/** Sustainable salary and the "worst-months test" (SYSTEM-OVERVIEW §5.3). */
import { CONFIG } from './config';
import { Rupiah, floorToStep, sum } from './money';
import { sortedAscending } from './statistics';

export type RecommendationBinding =
  /** The salary is held at 95% of average income so the Pool keeps growing. */
  | { kind: 'average_cap' }
  /** The weakest `months` months, repeated back-to-back, set the limit. */
  | { kind: 'worst_months'; months: number; weakest: number[] };

export interface Recommendation {
  amount: Rupiah;
  /** The unrounded limit the amount was rounded down from. */
  sustainable: number;
  poolNow: Rupiah;
  binding: RecommendationBinding;
}

function engineWindow(amounts: readonly number[]): number[] {
  return amounts.slice(-CONFIG.ENGINE_WINDOW_MONTHS);
}

function averageCap(window: readonly number[]): number {
  return ((1 - CONFIG.SAFETY_MARGIN) * sum(window)) / window.length;
}

/** For k = 1..n: (Pool + the k weakest months) / k. */
function worstMonthLimits(window: readonly number[], pool: Rupiah): number[] {
  let cumulative = 0;
  return sortedAscending(window).map((amount, index) => {
    cumulative += amount;
    return (pool + cumulative) / (index + 1);
  });
}

/** The highest salary the Pool can pay if the weakest months arrive back-to-back. Never negative. */
export function sustainableSalary(amounts: readonly number[], pool: Rupiah): number {
  const window = engineWindow(amounts);
  return Math.max(0, Math.min(averageCap(window), ...worstMonthLimits(window, pool)));
}

function bindingFor(window: readonly number[], pool: Rupiah): RecommendationBinding {
  const limits = worstMonthLimits(window, pool);
  const tightest = Math.min(...limits);
  if (averageCap(window) <= tightest) return { kind: 'average_cap' };
  const months = limits.indexOf(tightest) + 1;
  return { kind: 'worst_months', months, weakest: sortedAscending(window).slice(0, months) };
}

/** The recommended salary, or null with fewer than 3 months of data. */
export function recommendSalary(amounts: readonly number[], pool: Rupiah): Recommendation | null {
  if (amounts.length < CONFIG.MIN_RECOMMENDATION_MONTHS) return null;
  const sustainable = sustainableSalary(amounts, pool);
  return {
    amount: floorToStep(sustainable, CONFIG.RECOMMEND_ROUNDING),
    sustainable,
    poolNow: pool,
    binding: bindingFor(engineWindow(amounts), pool),
  };
}

/** True when a chosen salary is above the recommendation (needs the depletion disclosure). */
export function exceedsRecommendation(salary: Rupiah, recommended: Rupiah | null): boolean {
  return recommended !== null && salary > recommended;
}

/**
 * If the weakest months repeat, the month in which the Pool can no longer pay
 * `salary` (1 = the first month); null if it holds for the whole window.
 */
export function depletionMonth(amounts: readonly number[], pool: Rupiah, salary: Rupiah): number | null {
  let cumulative = 0;
  const weakestFirst = sortedAscending(engineWindow(amounts));
  for (const [index, amount] of weakestFirst.entries()) {
    cumulative += amount;
    if (pool + cumulative < (index + 1) * salary) return index + 1;
  }
  return null;
}
