import { amountDue, billReserveOf, owedOnLine } from '@/domain/credit-lines';
import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { owedOn } from '@/domain/installment-loans';
import { TestApp, onboardedApp } from '../../__tests__/helpers';
import { recordExpense } from '../../spending/spending-actions';
import {
  CreditLineInput, LoanInput, addCreditLine, addDebtCost, addLoan, closeCreditLine, payBill, payInstallment, payOffLoan,
} from '../debts-actions';
import { previewLoan } from '../loan-preview';

const PAYLATER: CreditLineInput = { name: 'PayLater', type: 'paylater', statementDay: 5, dueDay: 25, creditLimit: 5_000_000 };
const KREDIVO: LoanInput = {
  name: 'Kredivo', type: 'online_loan', purpose: 'personal', use: 'cash', received: 3_000_000, installmentAmount: 550_000,
  installmentCount: 6, frequency: 'monthly', firstDueDate: '2026-11-02', ojkRegistered: 'yes',
};

async function money(app: TestApp) {
  const transactions = (await app.snapshot()).transactions;
  const m = allMovements(transactions);
  return { pool: balanceOf(m, 'pool'), personal: balanceOf(m, 'personal'), transactions };
}

/** Onboarded on 1 Oct, so October purchases can be dated after the start; the clock then moves to 9 Oct. */
async function withPayLater() {
  const app = await onboardedApp({}, '2026-10-01');
  const added = await addCreditLine(app.ctx, PAYLATER);
  if (!added.ok) throw new Error('setup');
  app.setToday('2026-10-09');
  return { app, id: added.value.id };
}

describe('previewLoan', () => {
  const terms = { received: 2_000_000, installmentAmount: 2_600_000, installmentCount: 1, frequency: 'single' as const, startDate: '2026-09-01', firstDueDate: '2026-10-01' };

  it('shows what the loan costs, with the PRD example: about 365% a year', () => {
    expect(previewLoan(terms)).toMatchObject({ ok: true, preview: { totalToRepay: 2_600_000, cost: 600_000 } });
    const result = previewLoan(terms);
    expect(result.ok && result.preview.yearlyRate).toBeCloseTo(3.65, 6);
  });

  it('explains terms that cannot be right', () => {
    expect(previewLoan({ ...terms, installmentAmount: 1_000_000 })).toMatchObject({ ok: false, error: { title: 'You would repay less than you receive' } });
    expect(previewLoan({ ...terms, received: 0 })).toMatchObject({ ok: false, error: { title: 'Check the amount received' } });
    expect(previewLoan({ ...terms, firstDueDate: '2026-08-01' })).toMatchObject({ ok: false, error: { title: 'The first payment is before the loan starts' } });
    expect(previewLoan({ ...terms, installmentCount: 2 })).toMatchObject({ ok: false, error: { title: 'A single payment is one installment' } });
  });
});

describe('credit lines', () => {
  it('adds a credit line', async () => {
    const { app, id } = await withPayLater();
    expect((await app.snapshot()).debts.find((d) => d.id === id)).toMatchObject({ name: 'PayLater', kind: 'credit_line', statementDay: 5, dueDay: 25, creditLimit: 5_000_000, origin: 'manual', status: 'open' });
  });

  it('refuses a missing name and impossible days', async () => {
    const app = await onboardedApp();
    expect(await addCreditLine(app.ctx, { ...PAYLATER, name: '  ' })).toMatchObject({ ok: false, error: { title: 'Give it a name' } });
    expect(await addCreditLine(app.ctx, { ...PAYLATER, dueDay: 32 })).toMatchObject({ ok: false, error: { title: 'Check the days' } });
    expect((await app.snapshot()).debts).toEqual([]);
  });

  it('keeps Available Spending honest: a purchase is set aside and the bill is paid from the reserve', async () => {
    const { app, id } = await withPayLater();
    expect((await recordExpense(app.ctx, { amount: 1_200_000, category: 'wants', creditLineId: id, date: '2026-10-02' })).ok).toBe(true);
    let state = await money(app);
    expect(state.personal).toBe(4_250_000 - 1_200_000);
    expect(billReserveOf(state.transactions, id)).toBe(1_200_000);

    expect(await payBill(app.ctx, { debtId: id, amount: 1_200_000, source: 'personal' })).toEqual({ ok: true, value: { fromReserve: 1_200_000 } });
    state = await money(app);
    expect(state.personal).toBe(4_250_000 - 1_200_000);
    expect(owedOnLine(state.transactions, id)).toBe(0);
    expect(billReserveOf(state.transactions, id)).toBe(0);
  });

  it('pays an older balance from Available Spending after the reserve', async () => {
    const app = await onboardedApp({ debts: [{ kind: 'credit_line', name: 'PayLater', type: 'paylater', statementDay: 5, dueDay: 25, balance: 800_000, setAside: false }] });
    const id = (await app.snapshot()).debts[0]!.id;
    await recordExpense(app.ctx, { amount: 300_000, category: 'wants', creditLineId: id });
    expect(await payBill(app.ctx, { debtId: id, amount: 1_100_000, source: 'personal' })).toMatchObject({ ok: true, value: { fromReserve: 300_000 } });
    expect((await money(app)).personal).toBe(4_250_000 - 300_000 - 800_000);
  });

  it('can pay the bill from the Pool, handing the reserve back to Available Spending', async () => {
    const { app, id } = await withPayLater();
    await recordExpense(app.ctx, { amount: 500_000, category: 'needs', creditLineId: id });
    await payBill(app.ctx, { debtId: id, amount: 500_000, source: 'pool' });
    const state = await money(app);
    expect(state.pool).toBe(14_000_000 - 500_000);
    expect(state.personal).toBe(4_250_000);
  });

  it('refuses to pay more than is owed, saying how much is', async () => {
    const { app, id } = await withPayLater();
    await recordExpense(app.ctx, { amount: 500_000, category: 'needs', creditLineId: id });
    expect(await payBill(app.ctx, { debtId: id, amount: 600_000, source: 'personal' })).toEqual({
      ok: false, error: { title: "That's more than you owe", what: 'You owe Rp 500.000 on PayLater.', next: 'Pay up to Rp 500.000.' },
    });
    expect(await payBill(app.ctx, { debtId: id, amount: 0, source: 'personal' })).toMatchObject({ ok: false, error: { title: 'Check the amount' } });
    expect(await payBill(app.ctx, { debtId: 'nope', amount: 1, source: 'personal' })).toMatchObject({ ok: false, error: { title: 'That debt is gone' } });
  });

  it('adds interest and fees as cost that is set aside with the bill', async () => {
    const { app, id } = await withPayLater();
    await recordExpense(app.ctx, { amount: 500_000, category: 'needs', creditLineId: id });
    expect((await addDebtCost(app.ctx, { debtId: id, amount: 45_000, type: 'fee' })).ok).toBe(true);
    const state = await money(app);
    expect(owedOnLine(state.transactions, id)).toBe(545_000);
    expect(billReserveOf(state.transactions, id)).toBe(545_000);
    expect(state.personal).toBe(4_250_000 - 545_000);
  });

  it('measures the bill at the statement, not the purchases after it', async () => {
    const { app, id } = await withPayLater();
    expect((await recordExpense(app.ctx, { amount: 900_000, category: 'wants', creditLineId: id, date: '2026-10-02' })).ok).toBe(true);
    expect((await recordExpense(app.ctx, { amount: 400_000, category: 'wants', creditLineId: id, date: '2026-10-08' })).ok).toBe(true);
    const snapshot = await app.snapshot();
    const line = { id, statementDay: 5, dueDay: 25, limit: null };
    // The 5 Oct statement billed 900.000; the 400.000 bought on the 8th belongs to the next statement.
    expect(amountDue(snapshot.transactions, line, '2026-10-09')).toBe(900_000);
    expect(owedOnLine(snapshot.transactions, id)).toBe(1_300_000);
  });

  it('closes only when nothing is owed', async () => {
    const { app, id } = await withPayLater();
    await recordExpense(app.ctx, { amount: 100_000, category: 'wants', creditLineId: id });
    expect(await closeCreditLine(app.ctx, id)).toMatchObject({ ok: false, error: { title: 'Something is still owed', what: 'You owe Rp 100.000 on PayLater.' } });
    await payBill(app.ctx, { debtId: id, amount: 100_000, source: 'personal' });
    expect((await closeCreditLine(app.ctx, id)).ok).toBe(true);
    expect((await app.snapshot()).debts[0]!.status).toBe('closed');
  });
});

describe('loans', () => {
  async function withLoan(input: Partial<LoanInput> = {}) {
    const app = await onboardedApp();
    const added = await addLoan(app.ctx, { ...KREDIVO, ...input });
    if (!added.ok) throw new Error(`setup: ${added.error.title}`);
    return { app, id: added.value.id };
  }

  it('a personal cash loan goes to Available Spending and is never income', async () => {
    const { app, id } = await withLoan();
    const state = await money(app);
    expect(state.personal).toBe(4_250_000 + 3_000_000);
    expect(state.pool).toBe(14_000_000);
    expect(owedOn(state.transactions, id)).toBe(3_300_000);
    expect((await app.snapshot()).debts.find((d) => d.id === id)).toMatchObject({ amountReceived: 3_000_000, installmentAmount: 550_000, ojkRegistered: 'yes' });
  });

  it('a business loan goes to the Pool', async () => {
    const { app } = await withLoan({ purpose: 'business' });
    expect(await money(app)).toMatchObject({ pool: 17_000_000, personal: 4_250_000 });
  });

  it('an installment purchase is an expense at full price, with no cash received', async () => {
    const { app, id } = await withLoan({ use: 'purchase', type: 'installment_purchase', category: 'needs', received: 6_000_000, installmentAmount: 550_000, installmentCount: 12, name: 'Phone shop' });
    const state = await money(app);
    expect(state.personal).toBe(4_250_000);
    expect(owedOn(state.transactions, id)).toBe(6_600_000);
    expect(state.transactions.find((t) => t.kind === 'expense')).toMatchObject({ amount: 6_000_000, expenseCategory: 'needs', paymentMethod: 'installment', debtId: id });
  });

  it('refuses business purchases, missing names and impossible terms, writing nothing', async () => {
    const app = await onboardedApp();
    expect(await addLoan(app.ctx, { ...KREDIVO, use: 'purchase', purpose: 'business' })).toMatchObject({ ok: false, error: { title: 'An installment purchase is personal' } });
    expect(await addLoan(app.ctx, { ...KREDIVO, name: ' ' })).toMatchObject({ ok: false, error: { title: 'Give it a name' } });
    expect(await addLoan(app.ctx, { ...KREDIVO, installmentAmount: 100_000 })).toMatchObject({ ok: false, error: { title: 'You would repay less than you receive' } });
    expect((await app.snapshot()).debts).toEqual([]);
  });

  it('pays installments from Available Spending (personal) or the Pool (business) and closes at zero', async () => {
    const { app, id } = await withLoan({ installmentCount: 2, installmentAmount: 1_600_000, received: 3_000_000 });
    await payInstallment(app.ctx, { debtId: id });
    expect((await money(app)).personal).toBe(4_250_000 + 3_000_000 - 1_600_000);
    expect((await app.snapshot()).debts[0]!.status).toBe('open');
    await payInstallment(app.ctx, { debtId: id });
    expect((await app.snapshot()).debts[0]!.status).toBe('closed');

    const business = await withLoan({ purpose: 'business' });
    await payInstallment(business.app.ctx, { debtId: business.id });
    expect((await money(business.app)).pool).toBe(14_000_000 + 3_000_000 - 550_000);
  });

  it('refuses paying more than is owed', async () => {
    const { app, id } = await withLoan({ installmentCount: 1, installmentAmount: 3_300_000 });
    expect(await payInstallment(app.ctx, { debtId: id, amount: 3_300_001 })).toMatchObject({ ok: false, error: { title: "That's more than you owe" } });
  });

  it('adds a late fee to what is owed, without touching anything else', async () => {
    const { app, id } = await withLoan();
    const before = await money(app);
    await addDebtCost(app.ctx, { debtId: id, amount: 20_000, type: 'late_fee' });
    const after = await money(app);
    expect(owedOn(after.transactions, id)).toBe(3_320_000);
    expect(after.personal).toBe(before.personal);
  });

  it('pays off early, reporting the interest saved, and closes the loan', async () => {
    const { app, id } = await withLoan();
    await payInstallment(app.ctx, { debtId: id });
    expect(await payOffLoan(app.ctx, { debtId: id, paid: 2_650_000 })).toEqual({ ok: true, value: { interestSaved: 100_000 } });
    const state = await money(app);
    expect(owedOn(state.transactions, id)).toBe(0);
    expect(state.personal).toBe(4_250_000 + 3_000_000 - 550_000 - 2_650_000);
    expect((await app.snapshot()).debts[0]!.status).toBe('closed');
  });

  it('refuses a payoff above what is owed', async () => {
    const { app, id } = await withLoan();
    expect(await payOffLoan(app.ctx, { debtId: id, paid: 9_000_000 })).toMatchObject({ ok: false, error: { title: "That's more than you owe" } });
    expect((await app.snapshot()).debts[0]!.status).toBe('open');
  });
});
