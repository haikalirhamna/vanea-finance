/** Commitments, runway and safe surplus (SYSTEM-OVERVIEW §5.6, §6.6). */
import { Rupiah } from './money';

export interface RecurringCost {
  amount: Rupiah;
  cadence: 'monthly' | 'yearly';
  active: boolean;
}

/** Salary plus active recurring costs per month (yearly costs divided by 12). */
export function monthlyCommitment(salary: Rupiah, costs: readonly RecurringCost[]): Rupiah {
  const active = costs.filter((cost) => cost.active);
  const monthly = active.filter((cost) => cost.cadence === 'monthly').reduce((t, c) => t + c.amount, 0);
  const yearly = active.filter((cost) => cost.cadence === 'yearly').reduce((t, c) => t + c.amount, 0);
  return salary + monthly + Math.floor(yearly / 12);
}

/** How many months of commitments the Pool covers; null when there is no commitment. */
export function runwayMonths(pool: Rupiah, commitment: Rupiah): number | null {
  return commitment > 0 ? pool / commitment : null;
}

/** Pool money above the buffer. */
export function safeSurplus(pool: Rupiah, bufferMonths: number, commitment: Rupiah): Rupiah {
  return Math.max(0, pool - bufferMonths * commitment);
}
