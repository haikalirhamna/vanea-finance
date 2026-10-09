/**
 * The one way the app writes money: validate with the domain rules and record, all inside a single
 * database transaction. If the rules refuse, nothing is written and the user gets an explanation.
 */
import { DateString } from '@/domain/calendar';
import { Transaction } from '@/domain/ledger-types';
import { validateTransactions } from '@/domain/ledger-validation';
import { SqlDriver } from '@/data/driver';
import { Profile, getProfile } from '@/data/profile';
import { insertTransactions, loadTransactions } from '@/data/transactions';
import { ExplainedError, explainLedgerError } from './errors';

export interface ActionContext {
  driver: SqlDriver;
  /** The local calendar date. */
  today(): DateString;
  /** An ISO timestamp, for audit fields. */
  now(): string;
  newId(): string;
}

export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: ExplainedError };

export const success = <T>(value: T): ActionResult<T> => ({ ok: true, value });
export const failure = (error: ExplainedError): ActionResult<never> => ({ ok: false, error });

export async function requireProfile(driver: SqlDriver): Promise<Profile> {
  const profile = await getProfile(driver);
  if (!profile) throw new Error('Vanea has not been set up yet');
  return profile;
}

class Rollback extends Error {
  constructor(readonly result: ActionResult<never>) {
    super('rolled back');
  }
}

/**
 * Runs the work in one database transaction. If it returns a failure, everything it wrote
 * is rolled back, so an action either happens completely or not at all.
 */
export async function runAtomic<T>(ctx: ActionContext, work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await ctx.driver.transaction(async () => {
      const result = await work();
      if (!result.ok) throw new Rollback(result);
      return result;
    });
  } catch (error) {
    if (error instanceof Rollback) return error.result;
    throw error;
  }
}

/** Work done together with a batch, inside the same database transaction. */
export type AlongsideWork = (existing: readonly Transaction[]) => Promise<void>;

/**
 * Validates a batch against everything already recorded, then writes it. Call inside `runAtomic`.
 * Corrections (a reversal plus its replacement) go in as one batch so they are judged by their final state.
 */
export async function writeBatch(
  ctx: ActionContext,
  batch: readonly Transaction[],
  alongside?: AlongsideWork,
): Promise<ActionResult> {
  const profile = await requireProfile(ctx.driver);
  const existing = await loadTransactions(ctx.driver);
  const rules = { today: ctx.today(), onboardedOn: profile.onboardedOn };
  const verdict = validateTransactions(existing, batch, rules);
  if (!verdict.ok) return failure(explainLedgerError(verdict));
  await insertTransactions(ctx.driver, batch, ctx.now());
  if (alongside) await alongside(existing);
  return success(undefined);
}

/** The common case: one validated batch, written atomically. */
export function commitBatch(ctx: ActionContext, batch: readonly Transaction[], alongside?: AlongsideWork): Promise<ActionResult> {
  return runAtomic(ctx, () => writeBatch(ctx, batch, alongside));
}
