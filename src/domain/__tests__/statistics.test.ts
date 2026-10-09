import { mean, median, sortedAscending, usualSwing } from '../statistics';

describe('statistics', () => {
  it('computes the median of odd and even lists without mutating input', () => {
    const values = [9, 1, 5];
    expect(median(values)).toBe(5);
    expect(values).toEqual([9, 1, 5]);
    expect(median([4, 10, 3, 9, 4, 11])).toBe(6.5);
  });

  it('rejects empty lists', () => {
    expect(() => median([])).toThrow(RangeError);
    expect(() => mean([])).toThrow(RangeError);
  });

  it('sorts ascending and averages', () => {
    expect(sortedAscending([3, 1, 2])).toEqual([1, 2, 3]);
    expect(mean([2, 4, 9])).toBe(5);
  });

  it('measures the usual swing relative to the median', () => {
    expect(usualSwing([5, 5, 5, 5])).toBe(0);
    expect(usualSwing([4, 10, 3, 9, 4, 11])).toBeCloseTo(3 / 6.5, 10);
  });

  it('reports a full swing when the median is not positive', () => {
    expect(usualSwing([0, 0, 0])).toBe(1);
    expect(usualSwing([-5, -4, -3])).toBe(1);
  });
});
