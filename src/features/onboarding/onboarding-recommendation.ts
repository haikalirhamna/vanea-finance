/** The salary recommendation shown during onboarding (PRD ONB-6). */
import { DateString } from '@/domain/calendar';
import { amountsOf, HistoricalMonth, netIncomeSeries } from '@/domain/income-history';
import { Recommendation, recommendSalary } from '@/domain/salary-recommendation';

export interface OnboardingRecommendation {
  /** Null with fewer than 3 completed months of history. */
  recommendation: Recommendation | null;
  /** How many completed months the recommendation rests on. */
  monthsOfData: number;
}

/**
 * Historical income is evidence only: it feeds the recommendation but never the Pool.
 * Only the months that have completed count (the current month is partial).
 */
export function recommendForOnboarding(
  historical: readonly HistoricalMonth[],
  openingPool: number,
  today: DateString,
): OnboardingRecommendation {
  const amounts = amountsOf(netIncomeSeries([], historical, today));
  return { recommendation: recommendSalary(amounts, openingPool), monthsOfData: amounts.length };
}
