/** Recording income: it enters the Pool (PRD INC-1). */
import { DateString } from '@/domain/calendar';
import { ActionContext, ActionResult, commitBatch } from '../action-runtime';

export interface IncomeInput {
  amount: number;
  date?: DateString;
  source?: string;
  note?: string;
}

export function recordIncome(ctx: ActionContext, input: IncomeInput): Promise<ActionResult> {
  return commitBatch(ctx, [{
    id: ctx.newId(), kind: 'income', date: input.date ?? ctx.today(), amount: input.amount,
    ...(input.source ? { source: input.source } : {}), ...(input.note ? { note: input.note } : {}),
  }]);
}
