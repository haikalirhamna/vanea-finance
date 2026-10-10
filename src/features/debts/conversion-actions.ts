/** Converting a card or PayLater purchase into an installment loan (PRD DEBT-11, USER-FLOWS §22.1). */
import { billReserveOf, owedOnLine, planConversion } from '@/domain/credit-lines';
import { activeTransactions } from '@/domain/ledger';
import { Transaction } from '@/domain/ledger-types';
import { insertDebt } from '@/data/debts';
import { loadSnapshot } from '@/data/snapshot';
import { formatMoney } from '@/lib/format';
import { ActionContext, ActionResult, failure, runAtomic, success, writeBatch } from '../action-runtime';
import { ExplainedError, problem } from '../errors';
import { LoanTerms, previewLoan } from './loan-preview';

/** Marks which purchase a conversion took over; a descriptive note, never used by any money rule. */
const MARK = 'purchase:';

export interface ConvertInput {
  debtId: string;
  purchaseId: string;
  installmentAmount: number;
  installmentCount: number;
  firstDueDate: string;
}

/** The credit-line purchases that are still on the line, newest first. */
export function convertiblePurchases(transactions: readonly Transaction[], debtId: string): Transaction[] {
  const active = activeTransactions(transactions);
  const converted = new Set(active.filter((tx) => tx.kind === 'credit_conversion').map((tx) => tx.note?.replace(MARK, '')));
  return active
    .filter((tx) => tx.kind === 'expense' && tx.paymentMethod === 'credit_line' && tx.debtId === debtId && !converted.has(tx.id))
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

const REFUSALS = {
  ABOVE_OWED: (max?: number): ExplainedError => problem("That's more than is owed", `You owe ${formatMoney(max ?? 0)} on this line.`, 'Pick a smaller purchase.'),
  INVALID_AMOUNT: (): ExplainedError => problem('Check the amount', 'The purchase amount is not valid.', 'Pick the purchase again.'),
  REPAYS_LESS_THAN_PURCHASE: (): ExplainedError => problem(
    'You would repay less than the purchase', 'The installments add up to less than the purchase price.', 'Check the installment and the number of installments.',
  ),
} as const;

/**
 * The purchase leaves the line and its bill reserve; the reserved money returns to Available Spending and a new
 * installment loan starts. The expense keeps its full price in its original month.
 */
export async function convertPurchase(ctx: ActionContext, input: ConvertInput): Promise<ActionResult<{ loanId: string }>> {
  return runAtomic(ctx, async () => {
    const snapshot = await loadSnapshot(ctx.driver);
    const line = snapshot.debts.find((d) => d.id === input.debtId && d.kind === 'credit_line');
    const purchase = convertiblePurchases(snapshot.transactions, input.debtId).find((tx) => tx.id === input.purchaseId);
    if (!line || !purchase) return failure(problem('That purchase is not available', 'It was converted already, removed, or is not on this line.', 'Pick another purchase.'));
    const plan = planConversion({
      purchaseAmount: purchase.amount, owed: owedOnLine(snapshot.transactions, line.id), reserve: billReserveOf(snapshot.transactions, line.id),
      installmentAmount: input.installmentAmount, installmentCount: input.installmentCount,
    });
    if (!plan.ok) return failure(REFUSALS[plan.code](plan.max));
    const terms: LoanTerms = {
      received: purchase.amount, installmentAmount: input.installmentAmount, installmentCount: input.installmentCount,
      frequency: 'monthly', startDate: ctx.today(), firstDueDate: input.firstDueDate,
    };
    const checked = previewLoan(terms);
    if (!checked.ok) return failure(checked.error);
    const loanId = ctx.newId();
    await insertDebt(ctx.driver, {
      id: loanId, kind: 'installment_loan', name: `${line.name} installments`, type: line.type === 'paylater' ? 'paylater_installments' : 'card_installment_plan',
      purpose: 'personal', amountReceived: terms.received, installmentAmount: terms.installmentAmount, installmentCount: terms.installmentCount,
      frequency: 'monthly', startDate: terms.startDate, firstDueDate: terms.firstDueDate, origin: 'conversion', status: 'open',
    }, ctx.now());
    const written = await writeBatch(ctx, [{
      id: ctx.newId(), kind: 'credit_conversion', date: ctx.today(), amount: purchase.amount, debtId: line.id, targetDebtId: loanId,
      reservePart: plan.reservePart, totalOwed: plan.totalOwed, paymentMethod: 'credit_line', label: line.name, note: `${MARK}${purchase.id}`,
    }]);
    return written.ok ? success({ loanId }) : written;
  });
}
