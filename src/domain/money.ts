/** Money is always integer rupiah (SYSTEM-OVERVIEW §4). Ratios may be floats; results are rounded down. */
export type Rupiah = number;

export function isRupiah(value: number): boolean {
  return Number.isSafeInteger(value);
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function floorToStep(value: number, step: number): Rupiah {
  return Math.floor(value / step) * step;
}

export function ceilDivide(amount: Rupiah, divisor: number): Rupiah {
  return Math.ceil(amount / divisor);
}

/** Integer-exact percentage, rounded down (avoids 5000000 * 0.05 float noise). */
export function percentOf(amount: Rupiah, percent: number): Rupiah {
  return Math.floor((amount * percent) / 100);
}
