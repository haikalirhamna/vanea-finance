/** Commitments, own Pool, runway and safe surplus (SYSTEM-OVERVIEW §5.3, §5.6, §6.6). */
import { Rupiah, sum } from './money';

/**
 * Salary plus every recurring monthly cost: each subscription's monthly equivalent at today's
 * price (subscriptions.monthlyEquivalents) and each business-loan installment per month.
 */
export function monthlyCommitment(salary: Rupiah, monthlyCosts: readonly Rupiah[]): Rupiah {
  return salary + sum(monthlyCosts);
}

/** The Pool minus business-loan principal still owed: borrowed money never makes a salary look sustainable. */
export function ownPool(pool: Rupiah, businessPrincipalOwed: Rupiah): Rupiah {
  return Math.max(0, pool - businessPrincipalOwed);
}

/** How many months of commitments the Pool covers; null when there is no commitment. */
export function runwayMonths(pool: Rupiah, commitment: Rupiah): number | null {
  return commitment > 0 ? pool / commitment : null;
}

/** Pool money above the buffer. */
export function safeSurplus(pool: Rupiah, bufferMonths: number, commitment: Rupiah): Rupiah {
  return Math.max(0, pool - bufferMonths * commitment);
}
