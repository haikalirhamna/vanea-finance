/** Recording an expense, paid from Available Spending or with a credit line (PRD SPD-3, SPD-4, SPD-7). */
import { DateString } from '@/domain/calendar';
import { ExpenseCategory } from '@/domain/ledger-types';
import { loadDebts } from '@/data/debts';
import { ActionContext, ActionResult, commitBatch, failure } from '../action-runtime';
import { problem } from '../errors';

export interface ExpenseInput {
  amount: number;
  category: ExpenseCategory;
  date?: DateString;
  note?: string;
  /** Pay with this credit line instead of from Available Spending. */
  creditLineId?: string;
}

async function openCreditLineProblem(ctx: ActionContext, creditLineId: string): Promise<ActionResult | null> {
  const debt = (await loadDebts(ctx.driver)).find((d) => d.id === creditLineId);
  if (debt && debt.kind === 'credit_line' && debt.status === 'open') return null;
  return failure(problem('That credit line is not available', 'It was closed or does not exist.', 'Pick another way to pay.'));
}

/**
 * Expenses are never blocked: spending more than Available Spending shows an overspent state instead
 * (PRD principle 8). Only the structure of the record is checked.
 */
export async function recordExpense(ctx: ActionContext, input: ExpenseInput): Promise<ActionResult> {
  if (input.creditLineId) {
    const refused = await openCreditLineProblem(ctx, input.creditLineId);
    if (refused) return refused;
  }
  return commitBatch(ctx, [{
    id: ctx.newId(), kind: 'expense', date: input.date ?? ctx.today(), amount: input.amount, expenseCategory: input.category,
    ...(input.creditLineId ? { paymentMethod: 'credit_line' as const, debtId: input.creditLineId } : {}),
    ...(input.note ? { note: input.note } : {}),
  }]);
}
