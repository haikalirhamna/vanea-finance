import { monthlyCommitment, ownPool, runwayMonths, safeSurplus } from '../pool';

describe('monthlyCommitment', () => {
  it('adds every recurring monthly cost to the salary', () => {
    expect(monthlyCommitment(8_000_000, [225_000, 100_000])).toBe(8_325_000);
  });

  it('is just the salary without costs', () => {
    expect(monthlyCommitment(5_000_000, [])).toBe(5_000_000);
  });
});

describe('ownPool', () => {
  it('leaves out the principal of business loans that is still owed', () => {
    expect(ownPool(14_000_000, 3_000_000)).toBe(11_000_000);
  });

  it('is never negative and never above the Pool', () => {
    expect(ownPool(2_000_000, 3_000_000)).toBe(0);
    expect(ownPool(2_000_000, 0)).toBe(2_000_000);
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
