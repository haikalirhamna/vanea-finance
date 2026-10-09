/** Credit lines, PayLater and loans: add, spend, pay, and pay off (PRD §8.12). */
import { allMovements } from '@/domain/ledger-movements';
import { ExpenseCategory, Transaction } from '@/domain/ledger-types';
import { InstallmentLoan, LoanPurpose, earlyPayoffSaving, owedOn } from '@/domain/installment-loans';
import { billReserveOf, owedOnLine, planBillPayment } from '@/domain/credit-lines';
import { CreditLineType, DebtRecord, LoanType, insertDebt, loansOf, updateDebt } from '@/data/debts';
import { loadSnapshot } from '@/data/snapshot';
import { formatMoney } from '@/lib/format';
import { ActionContext, ActionResult, failure, runAtomic, success, writeBatch } from '../action-runtime';
import { problem } from '../errors';
import { LoanTerms, previewLoan } from './loan-preview';

export interface CreditLineInput {
  name: string;
  type: CreditLineType;
  statementDay: number;
  dueDay: number;
  creditLimit?: number;
  note?: string;
}

export interface LoanInput extends Omit<LoanTerms, 'startDate'> {
  name: string;
  type: LoanType;
  purpose: LoanPurpose;
  startDate?: string;
  /** Cash received, or a purchase paid for in installments (nothing is received in cash). */
  use: 'cash' | 'purchase';
  /** The Kakeibo category of an installment purchase. */
  category?: ExpenseCategory;
  ojkRegistered?: 'yes' | 'no' | 'unknown';
  note?: string;
}

export type DebtCostKind = 'interest' | 'fee' | 'late_fee';

const validDay = (day: number): boolean => Number.isInteger(day) && day >= 1 && day <= 31;

export async function addCreditLine(ctx: ActionContext, input: CreditLineInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return failure(problem('Give it a name', 'A credit line needs a name so you can tell it apart.', 'Enter a name, such as PayLater.'));
  if (!validDay(input.statementDay) || !validDay(input.dueDay)) {
    return failure(problem('Check the days', 'The statement day and due day have to be between 1 and 31.', 'Enter the days again.'));
  }
  const id = ctx.newId();
  return runAtomic(ctx, async () => {
    await insertDebt(ctx.driver, {
      id, kind: 'credit_line', name: input.name.trim(), type: input.type, purpose: 'personal',
      statementDay: input.statementDay, dueDay: input.dueDay, ...(input.creditLimit ? { creditLimit: input.creditLimit } : {}),
      ...(input.note ? { note: input.note } : {}), origin: 'manual', status: 'open',
    }, ctx.now());
    return success({ id });
  });
}

function loanRecord(id: string, input: LoanInput, startDate: string): DebtRecord {
  return {
    id, kind: 'installment_loan', name: input.name.trim(), type: input.type, purpose: input.purpose,
    amountReceived: input.received, installmentAmount: input.installmentAmount, installmentCount: input.installmentCount,
    frequency: input.frequency, startDate, firstDueDate: input.firstDueDate,
    ...(input.ojkRegistered ? { ojkRegistered: input.ojkRegistered } : {}), ...(input.note ? { note: input.note } : {}),
    origin: 'manual', status: 'open',
  };
}

function loanTransactions(ctx: ActionContext, id: string, input: LoanInput, startDate: string): Transaction[] {
  const base = { debtId: id, paymentMethod: 'installment' as const, label: input.name.trim(), date: startDate };
  const destination = input.purpose === 'business' ? 'pool' : input.use === 'cash' ? 'personal' : undefined;
  const start: Transaction = {
    id: ctx.newId(), kind: 'loan_start', amount: input.received, totalOwed: input.installmentAmount * input.installmentCount,
    ...(destination ? { destinationAccount: destination } : {}), ...base,
  };
  if (input.use !== 'purchase' || input.purpose !== 'personal') return [start];
  return [start, { id: ctx.newId(), kind: 'expense', amount: input.received, expenseCategory: input.category ?? 'wants', ...base }];
}

/** Adds a loan. Money received is never income: a personal cash loan goes to Available Spending, a business loan to the Pool. */
export async function addLoan(ctx: ActionContext, input: LoanInput): Promise<ActionResult<{ id: string }>> {
  const startDate = input.startDate ?? ctx.today();
  const checked = previewLoan({ ...input, startDate });
  if (!checked.ok) return failure(checked.error);
  if (input.use === 'purchase' && input.purpose === 'business') {
    return failure(problem('An installment purchase is personal', 'Business loans bring money into your Pool.', 'Choose cash received, or make it a personal loan.'));
  }
  if (!input.name.trim()) return failure(problem('Give it a name', 'A loan needs the lender\'s name.', 'Enter a name, such as Kredivo.'));
  const id = ctx.newId();
  return runAtomic(ctx, async () => {
    await insertDebt(ctx.driver, loanRecord(id, input, startDate), ctx.now());
    const written = await writeBatch(ctx, loanTransactions(ctx, id, input, startDate));
    return written.ok ? success({ id }) : written;
  });
}

async function findDebt(ctx: ActionContext, debtId: string) {
  const snapshot = await loadSnapshot(ctx.driver);
  const debt = snapshot.debts.find((d) => d.id === debtId);
  return { snapshot, debt };
}

const notFound = () => failure(problem('That debt is gone', 'It no longer exists.', 'Go back and refresh the list.'));

/** Pays a credit line's bill: the bill reserve first, the rest from Available Spending or the Pool. */
export async function payBill(
  ctx: ActionContext,
  input: { debtId: string; amount: number; source: 'personal' | 'pool' },
): Promise<ActionResult<{ fromReserve: number }>> {
  return runAtomic(ctx, async () => {
    const { snapshot, debt } = await findDebt(ctx, input.debtId);
    if (!debt || debt.kind !== 'credit_line') return notFound();
    const owed = owedOnLine(snapshot.transactions, debt.id);
    const plan = planBillPayment(input.amount, owed, billReserveOf(snapshot.transactions, debt.id), input.source);
    if (!plan.ok) {
      return failure(plan.code === 'ABOVE_OWED'
        ? problem("That's more than you owe", `You owe ${formatMoney(owed)} on ${debt.name}.`, `Pay up to ${formatMoney(owed)}.`)
        : problem('Check the amount', 'The amount has to be a whole number of rupiah above zero.', 'Enter the amount again.'));
    }
    const written = await writeBatch(ctx, [{
      id: ctx.newId(), kind: 'debt_payment', date: ctx.today(), amount: input.amount, debtId: debt.id,
      paymentMethod: 'credit_line', sourceAccount: input.source, reservePart: plan.reservePart, label: debt.name,
    }]);
    return written.ok ? success({ fromReserve: plan.reservePart }) : written;
  });
}

function loanOf(debt: DebtRecord): InstallmentLoan {
  return loansOf([debt])[0]!;
}

/** Pays an installment (default: the full installment). Personal loans are paid from Available Spending, business loans from the Pool. */
export async function payInstallment(ctx: ActionContext, input: { debtId: string; amount?: number }): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const { snapshot, debt } = await findDebt(ctx, input.debtId);
    if (!debt || debt.kind !== 'installment_loan') return notFound();
    const owed = owedOn(snapshot.transactions, debt.id);
    const amount = input.amount ?? Math.min(loanOf(debt).installmentAmount, owed);
    const written = await writeBatch(ctx, [{
      id: ctx.newId(), kind: 'debt_payment', date: ctx.today(), amount, debtId: debt.id, paymentMethod: 'installment',
      sourceAccount: debt.purpose === 'business' ? 'pool' : 'personal', label: debt.name,
    }], async () => {
      if (owed - amount <= 0) await updateDebt(ctx.driver, debt.id, { status: 'closed' }, ctx.now());
    });
    return written;
  });
}

/** Interest, a fee or a late fee: the cost of borrowing. Nothing else changes automatically. */
export async function addDebtCost(
  ctx: ActionContext,
  input: { debtId: string; amount: number; type: DebtCostKind },
): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const { debt } = await findDebt(ctx, input.debtId);
    if (!debt) return notFound();
    return writeBatch(ctx, [{
      id: ctx.newId(), kind: 'debt_cost', date: ctx.today(), amount: input.amount, debtId: debt.id, debtCostType: input.type,
      paymentMethod: debt.kind === 'credit_line' ? 'credit_line' : 'installment', label: debt.name,
    }]);
  });
}

/** Pays a loan off early: pays `paid`, clears everything owed, and reports the interest saved. */
export async function payOffLoan(
  ctx: ActionContext,
  input: { debtId: string; paid: number },
): Promise<ActionResult<{ interestSaved: number }>> {
  return runAtomic(ctx, async () => {
    const { snapshot, debt } = await findDebt(ctx, input.debtId);
    if (!debt || debt.kind !== 'installment_loan') return notFound();
    const owed = owedOn(snapshot.transactions, debt.id);
    if (input.paid > owed) {
      return failure(problem("That's more than you owe", `You owe ${formatMoney(owed)} on ${debt.name}.`, `Pay up to ${formatMoney(owed)}.`));
    }
    const written = await writeBatch(ctx, [{
      id: ctx.newId(), kind: 'debt_payoff', date: ctx.today(), amount: input.paid, debtId: debt.id, paymentMethod: 'installment',
      sourceAccount: debt.purpose === 'business' ? 'pool' : 'personal', clearedAmount: owed, label: debt.name,
    }], () => updateDebt(ctx.driver, debt.id, { status: 'closed' }, ctx.now()));
    return written.ok ? success({ interestSaved: earlyPayoffSaving(owed, input.paid) }) : written;
  });
}

/** A credit line can be closed once nothing is owed on it. */
export async function closeCreditLine(ctx: ActionContext, debtId: string): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const { snapshot, debt } = await findDebt(ctx, debtId);
    if (!debt || debt.kind !== 'credit_line') return notFound();
    const owed = allMovements(snapshot.transactions).filter((m) => m.account === 'debt' && m.refId === debtId).reduce((t, m) => t + m.amount, 0);
    if (owed > 0) {
      return failure(problem('Something is still owed', `You owe ${formatMoney(owed)} on ${debt.name}.`, 'Pay the balance first, then close it.'));
    }
    await updateDebt(ctx.driver, debtId, { status: 'closed' }, ctx.now());
    return success(undefined);
  });
}

