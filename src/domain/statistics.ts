export function sortedAscending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('mean of an empty list');
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('median of an empty list');
  const sorted = sortedAscending(values);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * The user's "usual swing": median distance from the median, relative to the median.
 * A non-positive median returns 1 (a swing of 100%) so no shift can look significant.
 */
export function usualSwing(values: readonly number[]): number {
  const middle = median(values);
  if (middle <= 0) return 1;
  return median(values.map((value) => Math.abs(value - middle))) / middle;
}
