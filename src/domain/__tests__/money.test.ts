import { ceilDivide, floorToStep, isRupiah, percentOf, sum } from '../money';

describe('money', () => {
  it('accepts only whole rupiah', () => {
    expect(isRupiah(4_250_000)).toBe(true);
    expect(isRupiah(0)).toBe(true);
    expect(isRupiah(10.5)).toBe(false);
    expect(isRupiah(Number.NaN)).toBe(false);
  });

  it('floors to a step', () => {
    expect(floorToStep(5_333_333.33, 50_000)).toBe(5_300_000);
    expect(floorToStep(49_999, 50_000)).toBe(0);
    expect(floorToStep(250_000, 10_000)).toBe(250_000);
  });

  it('computes exact integer percentages without float noise', () => {
    expect(percentOf(5_000_000, 5)).toBe(250_000);
    expect(percentOf(5_200_000, 5)).toBe(260_000);
    expect(percentOf(999, 5)).toBe(49);
  });

  it('divides rounding up and sums', () => {
    expect(ceilDivide(1_000_000, 3)).toBe(333_334);
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});
