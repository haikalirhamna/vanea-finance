import { monthlyCommitment, runwayMonths, safeSurplus } from '../pool';

describe('monthlyCommitment', () => {
  it('adds active monthly costs and yearly costs divided by 12', () => {
    const costs = [
      { amount: 225_000, cadence: 'monthly' as const, active: true },
      { amount: 1_200_000, cadence: 'yearly' as const, active: true },
      { amount: 999_000, cadence: 'monthly' as const, active: false },
    ];
    expect(monthlyCommitment(8_000_000, costs)).toBe(8_000_000 + 225_000 + 100_000);
  });

  it('is just the salary without costs', () => {
    expect(monthlyCommitment(5_000_000, [])).toBe(5_000_000);
  });

  it('rounds the yearly share down once', () => {
    const costs = [
      { amount: 100, cadence: 'yearly' as const, active: true },
      { amount: 100, cadence: 'yearly' as const, active: true },
    ];
    expect(monthlyCommitment(0, costs)).toBe(16);
  });
});

describe('runway and safe surplus', () => {
  it('divides the Pool by the commitment', () => {
    expect(runwayMonths(14_000_000, 8_500_000)).toBeCloseTo(1.647, 3);
    expect(runwayMonths(0, 8_000_000)).toBe(0);
  });

  it('has no runway without a commitment', () => {
    expect(runwayMonths(1_000_000, 0)).toBeNull();
  });

  it('keeps a buffer and never reports a negative surplus', () => {
    expect(safeSurplus(40_000_000, 3, 8_000_000)).toBe(16_000_000);
    expect(safeSurplus(10_000_000, 3, 8_000_000)).toBe(0);
  });
});
