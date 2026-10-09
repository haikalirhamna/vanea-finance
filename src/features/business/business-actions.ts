/** Recording a business cost paid from the Pool (PRD BIZ-1, BIZ-2). */
import { DateString } from '@/domain/calendar';
import { BillingCycle, BusinessCostCategory } from '@/domain/ledger-types';
import { ActionContext, ActionResult, commitBatch, failure } from '../action-runtime';
import { problem } from '../errors';

export interface BusinessCostInput {
  amount: number;
  category: BusinessCostCategory;
  date?: DateString;
  /** Required for a subscription: yearly charges are spread over 12 months in net income. */
  billingCycle?: BillingCycle;
  /** The subscription's name, kept with the record. */
  label?: string;
  note?: string;
}

/** A subscription always asks how it is billed; other categories are one-off and ask nothing extra. */
export function recordBusinessCost(ctx: ActionContext, input: BusinessCostInput): Promise<ActionResult> {
  if (input.category === 'subscription' && !input.billingCycle) {
    return Promise.resolve(failure(problem('Is it monthly or yearly?', 'A subscription needs to know how often it is billed.', 'Choose monthly or yearly.')));
  }
  return commitBatch(ctx, [{
    id: ctx.newId(), kind: 'business_cost', date: input.date ?? ctx.today(), amount: input.amount, businessCostCategory: input.category,
    ...(input.category === 'subscription' && input.billingCycle ? { billingCycle: input.billingCycle } : {}),
    ...(input.label ? { label: input.label } : {}), ...(input.note ? { note: input.note } : {}),
  }]);
}
