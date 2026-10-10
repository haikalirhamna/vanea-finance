import { EvaluationRecord } from '@/data/salary-evaluations';
import { describeReview } from '../review-copy';

const base: EvaluationRecord = {
  id: 'e', evaluatedMonth: '2027-05', status: 'OBSERVING', currentSalary: 5_000_000, dataMonths: 8, poolAtEvaluation: 10_000_000,
  decision: 'none', createdAt: '2027-05-01T00:00:00Z',
};
const months = (amounts: number[]) => JSON.stringify(amounts.map((amount, i) => ({ month: `2027-0${i + 2}`, amount })));

describe('describeReview', () => {
  it('says how much data is missing', () => {
    expect(describeReview({ ...base, status: 'INSUFFICIENT_DATA', dataMonths: 4 }, null).message)
      .toBe('We need at least 6 months of income to review your salary. You have 4.');
  });

  it('names the month the review comes back after a recent change', () => {
    expect(describeReview({ ...base, status: 'COOLDOWN' }, '2027-02').message).toContain('in May');
  });

  it('gives the amount each month needs and the lowest one', () => {
    const view = describeReview({ ...base, referenceIncome: 5_000_000, thresholdBp: 500, swingBp: 100, recentMonthsJson: months([5_200_000, 5_300_000, 5_400_000]) }, null);
    expect(view.message).toBe("Your income hasn't stayed clearly above its usual level yet. Each of the last 3 months needs to be at least Rp 5.250.000. Your lowest was Rp 5.200.000.");
  });

  it('adds the volatility sentence only when the swing sets the bar', () => {
    const volatile = describeReview({ ...base, referenceIncome: 5_000_000, thresholdBp: 4500, swingBp: 3000, recentMonthsJson: months([5_200_000]) }, null);
    expect(volatile.message).toContain('usually moves about 30%');
  });

  it('shows the evidence of an eligible review', () => {
    const view = describeReview({ ...base, status: 'ELIGIBLE', referenceIncome: 5_300_000, thresholdBp: 600, recentMonthsJson: months([6_000_000, 6_200_000, 6_400_000]) }, null);
    expect(view.rows[0]).toEqual({ label: 'Typical income before', value: 'Rp 5.300.000' });
    expect(view.rows[1]).toEqual({ label: 'Last 3 months', value: 'Rp 6.000.000 · Rp 6.200.000 · Rp 6.400.000' });
    expect(view.rows[2]).toEqual({ label: 'Needed each month', value: 'Rp 5.618.000 or more' });
  });
});
