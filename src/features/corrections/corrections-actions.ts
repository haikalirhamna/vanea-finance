/**
 * Fixing mistakes without rewriting history (PRD COR-1..3, SYSTEM-OVERVIEW §6.7):
 * money fields change through a reversal plus a replacement; descriptive fields change in place.
 */
import { DateString } from '@/domain/calendar';
import { createReversal, planIncomeReversal, reversedIds } from '@/domain/ledger';
import { BillingCycle, BusinessCostCategory, ExpenseCategory, Transaction, TransactionKind } from '@/domain/ledger-types';
import { addRemainderToAdvance, advanceForRemainder } from '@/domain/salary-advance';
import { firstUnpaidPeriod } from '@/domain/salary-change';
import { DescriptiveFields, markReplaced, updateDescriptive } from '@/data/transactions';
import { insertAdvance, updateAdvance } from '@/data/salary';
import { loadSnapshot } from '@/data/snapshot';
import { ActionContext, ActionResult, failure, runAtomic, success, writeBatch } from '../action-runtime';
import { problem } from '../errors';
import { activeAdvanceOf } from '../salary/salary-state';

/** Kinds whose amount or date the user can correct. */
const EDITABLE: readonly TransactionKind[] = ['income', 'expense', 'business_cost', 'debt_cost', 'savings_deposit', 'savings_withdrawal'];

/** Kinds the user can remove. Opening balances and loan starts are not: remove the debt instead. */
const REMOVABLE: readonly TransactionKind[] = [...EDITABLE, 'salary_payment', 'debt_payment'];

export const canEdit = (kind: TransactionKind): boolean => EDITABLE.includes(kind);
export const canRemove = (kind: TransactionKind): boolean => REMOVABLE.includes(kind);

export interface TransactionEdit {
  amount?: number;
  date?: DateString;
  billingCycle?: BillingCycle;
}

const notFound = () => failure(problem('That record is gone', 'It no longer exists.', 'Go back and refresh the list.'));
const notAllowed = () => failure(problem("That can't be changed here", 'This kind of record is not corrected from the list.', 'Remove the loan or credit line it belongs to instead.'));

function findOriginal(transactions: readonly Transaction[], id: string): Transaction | null {
  const original = transactions.find((tx) => tx.id === id);
  return original && original.kind !== 'reversal' && !reversedIds(transactions).has(id) ? original : null;
}

/** Corrects an amount, date or billing cycle: the original is reversed and a corrected record takes its place. */
export async function editTransaction(ctx: ActionContext, id: string, changes: TransactionEdit): Promise<ActionResult<{ id: string }>> {
  return runAtomic(ctx, async () => {
    const { transactions } = await loadSnapshot(ctx.driver);
    const original = findOriginal(transactions, id);
    if (!original) return notFound();
    if (!EDITABLE.includes(original.kind)) return notAllowed();
    const replacement: Transaction = { ...original, ...changes, id: ctx.newId() };
    const reversal = createReversal(original, { id: ctx.newId(), date: ctx.today() });
    const written = await writeBatch(ctx, [reversal, replacement], () => markReplaced(ctx.driver, original.id, replacement.id, ctx.now()));
    return written.ok ? success({ id: replacement.id }) : written;
  });
}

export interface RemovalOutcome {
  /** Part of a removed income the Pool could not give back; it became a salary advance. */
  remainderAsAdvance: number;
}

/** Records the shortfall of a refunded income as a salary advance: a new one, or added to the active one. */
async function coverRemainder(ctx: ActionContext, remainder: number, transactions: readonly Transaction[], reversalId: string): Promise<void> {
  const snapshot = await loadSnapshot(ctx.driver);
  const active = activeAdvanceOf(snapshot.advances, transactions);
  if (active) {
    const merged = addRemainderToAdvance(active.record, active.outstanding, remainder);
    await updateAdvance(ctx.driver, active.record.id, merged, ctx.now());
    return;
  }
  const terms = advanceForRemainder(remainder);
  const firstPeriod = firstUnpaidPeriod(transactions, ctx.today(), snapshot.profile!.paydayDay);
  await insertAdvance(ctx.driver, {
    id: ctx.newId(), amount: terms.amount, termPeriods: terms.termPeriods, installmentAmount: terms.installmentAmount,
    firstPeriod, origin: 'income_reversal', originTransactionId: reversalId, status: 'active',
  }, ctx.now());
}

/** A salary payment that carried an advance installment reopens that advance when it is removed. */
async function reopenAdvance(ctx: ActionContext, original: Transaction): Promise<void> {
  if (!original.advanceId || !original.advanceInstallment) return;
  const { advances } = await loadSnapshot(ctx.driver);
  if (advances.some((a) => a.status === 'active')) return;
  await updateAdvance(ctx.driver, original.advanceId, { status: 'active' }, ctx.now());
}

/**
 * Removes a record by reversing it. A removed income that the Pool can no longer fully return
 * (part of it was already paid out as salary) turns the rest into a salary advance (SYSTEM-OVERVIEW §6.5).
 */
export async function deleteTransaction(ctx: ActionContext, id: string): Promise<ActionResult<RemovalOutcome>> {
  return runAtomic(ctx, async () => {
    const { transactions } = await loadSnapshot(ctx.driver);
    const original = findOriginal(transactions, id);
    if (!original) return notFound();
    if (!REMOVABLE.includes(original.kind)) return notAllowed();
    const plan = original.kind === 'income' ? planIncomeReversal(transactions, id, ctx.today()) : null;
    const reversal = createReversal(original, { id: ctx.newId(), date: ctx.today(), ...(plan ? { amount: plan.poolPart } : {}) });
    const remainder = plan?.remainder ?? 0;
    const written = await writeBatch(ctx, [reversal], async () => {
      if (remainder > 0) await coverRemainder(ctx, remainder, transactions, reversal.id);
      await reopenAdvance(ctx, original);
    });
    return written.ok ? success({ remainderAsAdvance: remainder }) : written;
  });
}

export interface DescriptiveEdit {
  note?: string | null;
  source?: string | null;
  label?: string | null;
  expenseCategory?: ExpenseCategory;
  businessCostCategory?: BusinessCostCategory;
}

/** Notes, labels and categories can change in place: they never move money. */
export async function editDescription(ctx: ActionContext, id: string, fields: DescriptiveEdit): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const { transactions } = await loadSnapshot(ctx.driver);
    if (!findOriginal(transactions, id)) return notFound();
    const fixed: DescriptiveFields = fields;
    await updateDescriptive(ctx.driver, id, fixed, ctx.now());
    return success(undefined);
  });
}
