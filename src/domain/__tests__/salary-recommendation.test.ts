import { depletionMonth, exceedsRecommendation, recommendSalary, sustainableSalary } from '../salary-recommendation';
import { million } from './helpers/builders';

describe('recommendSalary', () => {
  it('reproduces the worked example (SYSTEM-OVERVIEW §5.3)', () => {
    const result = recommendSalary(million(4, 10, 3, 9, 4, 11), 5_000_000)!;
    expect(result.amount).toBe(5_300_000);
    expect(result.sustainable).toBeCloseTo(5_333_333.33, 1);
    expect(result.binding).toEqual({ kind: 'worst_months', months: 3, weakest: million(3, 4, 4) });
    expect(result.poolNow).toBe(5_000_000);
  });

  it('holds stable income at 95% of the average so the Pool can grow', () => {
    const result = recommendSalary(million(5, 5, 5, 5, 5, 5), 0)!;
    expect(result.amount).toBe(4_750_000);
    expect(result.binding).toEqual({ kind: 'average_cap' });
  });

  it('needs at least three months', () => {
    expect(recommendSalary(million(5, 5), 10_000_000)).toBeNull();
    expect(recommendSalary(million(5, 5, 5), 0)).not.toBeNull();
  });

  it('only looks at the latest twelve months', () => {
    const old = Array(6).fill(1_000_000);
    const recent = Array(12).fill(5_000_000);
    expect(recommendSalary([...old, ...recent], 0)!.amount).toBe(4_750_000);
  });

  it('can recommend nothing safe when income dried up and the Pool is empty', () => {
    expect(recommendSalary([0, 0, 0, 0], 0)!.amount).toBe(0);
  });

  it('rounds down to Rp 50.000', () => {
    expect(recommendSalary([5_049_000, 5_049_000, 5_049_000], 100_000_000)!.amount % 50_000).toBe(0);
  });
});

describe('sustainableSalary', () => {
  it('is never negative', () => {
    expect(sustainableSalary([-5_000_000, -5_000_000, -5_000_000], 0)).toBe(0);
  });

  it('grows with the Pool until the average cap binds', () => {
    const income = million(4, 10, 3, 9, 4, 11);
    expect(sustainableSalary(income, 0)).toBeLessThan(sustainableSalary(income, 5_000_000));
    expect(sustainableSalary(income, 500_000_000)).toBeCloseTo(0.95 * (41_000_000 / 6), 2);
  });
});

describe('depletionMonth', () => {
  const income = million(4, 10, 3, 9, 4, 11);

  it('finds the month the Pool runs out if the weakest months repeat', () => {
    expect(depletionMonth(income, 5_000_000, 6_500_000)).toBe(2);
  });

  it('is null when the salary holds for the whole window', () => {
    expect(depletionMonth(income, 5_000_000, 5_300_000)).toBeNull();
  });

  it('runs out in month 1 when the weakest month cannot cover it', () => {
    expect(depletionMonth(income, 0, 3_500_000)).toBe(1);
  });
});

describe('exceedsRecommendation', () => {
  it('flags only salaries above a known recommendation', () => {
    expect(exceedsRecommendation(6_000_000, 5_300_000)).toBe(true);
    expect(exceedsRecommendation(5_300_000, 5_300_000)).toBe(false);
    expect(exceedsRecommendation(6_000_000, null)).toBe(false);
  });
});
