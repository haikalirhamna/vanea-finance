import { activeTransactions, balanceOf, reversedIds } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { loadAdvances } from '@/data/salary';
import { loadReplacements } from '@/data/transactions';
import { TestApp, onboardedApp } from '../../__tests__/helpers';
import { recordBusinessCost } from '../../business/business-actions';
import { addCreditLine, addLoan, payBill } from '../../debts/debts-actions';
import { recordIncome } from '../../income/income-actions';
import { paySalary } from '../../salary/salary-actions';
import { activeAdvanceOf } from '../../salary/salary-state';
import { recordExpense } from '../../spending/spending-actions';
import { deleteTransaction, editDescription, editTransaction } from '../corrections-actions';

async function state(app: TestApp) {
  const snapshot = await app.snapshot();
  const m = allMovements(snapshot.transactions);
  return { snapshot, pool: balanceOf(m, 'pool'), personal: balanceOf(m, 'personal') };
}

async function lastId(app: TestApp, kind: string) {
  return (await app.snapshot()).transactions.filter((t) => t.kind === kind).at(-1)!.id;
}

describe('editTransaction', () => {
  it('corrects an amount: the original is reversed, a corrected record takes its place, and balances follow', async () => {
    const app = await onboardedApp();
    await recordExpense(app.ctx, { amount: 100_000, category: 'wants', note: 'Lunch' });
    const id = await lastId(app, 'expense');
    const edited = await editTransaction(app.ctx, id, { amount: 150_000 });
    expect(edited.ok).toBe(true);
    const { snapshot, personal } = await state(app);
    expect(personal).toBe(4_250_000 - 150_000);
    expect(reversedIds(snapshot.transactions).has(id)).toBe(true);
    const replacementId = edited.ok ? edited.value.id : '';
    expect(snapshot.transactions.find((t) => t.id === replacementId)).toMatchObject({ amount: 150_000, note: 'Lunch', expenseCategory: 'wants' });
    expect((await loadReplacements(app.driver)).get(id)).toBe(replacementId);
  });

  it('corrects a date, keeping the amount', async () => {
    const app = await onboardedApp({}, '2026-10-01');
    app.setToday('2026-10-09');
    await recordIncome(app.ctx, { amount: 1_000_000, date: '2026-10-08' });
    await editTransaction(app.ctx, await lastId(app, 'income'), { date: '2026-10-03' });
    const [income] = activeTransactions((await state(app)).snapshot.transactions).filter((t) => t.kind === 'income');
    expect(income).toMatchObject({ amount: 1_000_000, date: '2026-10-03' });
  });

  it('judges an edit by its final state: raising income that was already paid out is fine', async () => {
    const app = await onboardedApp({ openingBalances: { pool: 0, personal: 0, savings: 0 }, salary: 1_000_000 });
    await recordIncome(app.ctx, { amount: 1_000_000 });
    app.setToday('2026-10-25');
    await paySalary(app.ctx, { amount: 900_000 });
    expect((await editTransaction(app.ctx, await lastId(app, 'income'), { amount: 1_500_000 })).ok).toBe(true);
    expect((await state(app)).pool).toBe(600_000);
  });

  it('refuses an edit that would leave the Pool negative, changing nothing', async () => {
    const app = await onboardedApp({ openingBalances: { pool: 0, personal: 0, savings: 0 }, salary: 1_000_000 });
    await recordIncome(app.ctx, { amount: 1_000_000 });
    app.setToday('2026-10-25');
    await paySalary(app.ctx, { amount: 900_000 });
    const before = await state(app);
    expect(await editTransaction(app.ctx, await lastId(app, 'income'), { amount: 500_000 })).toMatchObject({ ok: false, error: { title: 'Not enough in your Pool' } });
    expect((await state(app)).snapshot.transactions).toEqual(before.snapshot.transactions);
  });

  it('can change how a subscription is billed, which changes how it is spread', async () => {
    const app = await onboardedApp();
    await recordBusinessCost(app.ctx, { amount: 2_400_000, category: 'subscription', billingCycle: 'monthly' });
    await editTransaction(app.ctx, await lastId(app, 'business_cost'), { billingCycle: 'yearly' });
    const [cost] = activeTransactions((await state(app)).snapshot.transactions).filter((t) => t.kind === 'business_cost');
    expect(cost).toMatchObject({ billingCycle: 'yearly', amount: 2_400_000 });
  });

  it('refuses unknown, already-removed and uneditable records', async () => {
    const app = await onboardedApp();
    expect(await editTransaction(app.ctx, 'nope', { amount: 1 })).toMatchObject({ ok: false, error: { title: 'That record is gone' } });
    await recordExpense(app.ctx, { amount: 100_000, category: 'needs' });
    const id = await lastId(app, 'expense');
    await deleteTransaction(app.ctx, id);
    expect(await editTransaction(app.ctx, id, { amount: 1 })).toMatchObject({ ok: false, error: { title: 'That record is gone' } });
    const opening = (await state(app)).snapshot.transactions.find((t) => t.kind === 'opening_balance')!;
    expect(await editTransaction(app.ctx, opening.id, { amount: 1 })).toMatchObject({ ok: false, error: { title: "That can't be changed here" } });
  });
});

describe('deleteTransaction', () => {
  it('removes a record and restores the balance, leaving the original visible with its reversal', async () => {
    const app = await onboardedApp();
    await recordExpense(app.ctx, { amount: 230_000, category: 'needs' });
    const id = await lastId(app, 'expense');
    expect(await deleteTransaction(app.ctx, id)).toEqual({ ok: true, value: { remainderAsAdvance: 0 } });
    const { snapshot, personal } = await state(app);
    expect(personal).toBe(4_250_000);
    expect(snapshot.transactions.map((t) => t.kind).slice(-2)).toEqual(['expense', 'reversal']);
  });

  it('refuses records that cannot be removed this way', async () => {
    const app = await onboardedApp();
    const added = await addLoan(app.ctx, { name: 'K', type: 'online_loan', purpose: 'personal', use: 'cash', received: 1_000_000, installmentAmount: 120_000, installmentCount: 10, frequency: 'monthly', firstDueDate: '2026-11-02' });
    expect(added.ok).toBe(true);
    const start = (await app.snapshot()).transactions.find((t) => t.kind === 'loan_start')!;
    expect(await deleteTransaction(app.ctx, start.id)).toMatchObject({ ok: false, error: { title: "That can't be changed here" } });
  });

  it('refuses removing a credit purchase whose reserve was already used for the bill', async () => {
    const app = await onboardedApp({}, '2026-10-01');
    const line = await addCreditLine(app.ctx, { name: 'PayLater', type: 'paylater', statementDay: 5, dueDay: 25 });
    const id = line.ok ? line.value.id : '';
    app.setToday('2026-10-09');
    await recordExpense(app.ctx, { amount: 500_000, category: 'wants', creditLineId: id });
    await payBill(app.ctx, { debtId: id, amount: 500_000, source: 'personal' });
    expect(await deleteTransaction(app.ctx, await lastId(app, 'expense'))).toMatchObject({ ok: false, error: { title: 'Not enough set aside for this bill' } });
  });

  describe('a refunded income', () => {
    it('is returned from the Pool when the Pool can absorb it', async () => {
      const app = await onboardedApp();
      await recordIncome(app.ctx, { amount: 3_000_000 });
      expect(await deleteTransaction(app.ctx, await lastId(app, 'income'))).toEqual({ ok: true, value: { remainderAsAdvance: 0 } });
      expect((await state(app)).pool).toBe(14_000_000);
      expect(await loadAdvances(app.driver)).toEqual([]);
    });

    async function paidOutIncome() {
      const app = await onboardedApp({ openingBalances: { pool: 0, personal: 0, savings: 0 }, salary: 800_000 });
      await recordIncome(app.ctx, { amount: 1_000_000 });
      app.setToday('2026-10-25');
      await paySalary(app.ctx, { amount: 800_000 });
      return app;
    }

    it('becomes a salary advance for what was already paid out (PRD INC-2)', async () => {
      const app = await paidOutIncome();
      expect(await deleteTransaction(app.ctx, await lastId(app, 'income'))).toEqual({ ok: true, value: { remainderAsAdvance: 800_000 } });
      const { snapshot, pool } = await state(app);
      expect(pool).toBe(0);
      const [advance] = await loadAdvances(app.driver);
      expect(advance).toMatchObject({ amount: 800_000, termPeriods: 3, installmentAmount: 266_667, origin: 'income_reversal', status: 'active' });
      expect(activeAdvanceOf(snapshot.advances, snapshot.transactions)?.outstanding).toBe(800_000);
    });

    it('adds to an advance that is already active', async () => {
      const app = await paidOutIncome();
      await deleteTransaction(app.ctx, await lastId(app, 'income'));
      await recordIncome(app.ctx, { amount: 500_000 });
      await recordBusinessCost(app.ctx, { amount: 500_000, category: 'tools' });
      expect(await deleteTransaction(app.ctx, (await state(app)).snapshot.transactions.filter((t) => t.kind === 'income').at(-1)!.id)).toEqual({ ok: true, value: { remainderAsAdvance: 500_000 } });
      const advances = await loadAdvances(app.driver);
      expect(advances).toHaveLength(1);
      expect(advances[0]).toMatchObject({ amount: 1_300_000, installmentAmount: 266_667, status: 'active' });
    });

    it('records the whole income as an advance when the Pool is empty', async () => {
      const app = await onboardedApp({ openingBalances: { pool: 0, personal: 0, savings: 0 }, salary: 1_000_000 });
      await recordIncome(app.ctx, { amount: 1_000_000 });
      app.setToday('2026-10-25');
      await paySalary(app.ctx, { amount: 1_000_000 });
      expect(await deleteTransaction(app.ctx, await lastId(app, 'income'))).toEqual({ ok: true, value: { remainderAsAdvance: 1_000_000 } });
      expect((await state(app)).pool).toBe(0);
      expect((await loadAdvances(app.driver))[0]!.amount).toBe(1_000_000);
    });
  });

  it('reopens an advance when the payment that repaid it is removed', async () => {
    const app = await onboardedApp();
    await app.driver.run("INSERT INTO salary_advances (id, amount, term_periods, installment_amount, first_period, origin, status, created_at, updated_at) VALUES ('adv', 1000000, 1, 1000000, '2026-10', 'manual', 'active', ?, ?)", ['2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z']);
    app.setToday('2026-10-25');
    await paySalary(app.ctx, { amount: 3_700_000 });
    expect((await loadAdvances(app.driver))[0]!.status).toBe('repaid');
    await deleteTransaction(app.ctx, await lastId(app, 'salary_payment'));
    expect((await loadAdvances(app.driver))[0]!.status).toBe('active');
  });
});

describe('editDescription', () => {
  it('changes notes, labels and categories in place without touching money', async () => {
    const app = await onboardedApp();
    await recordExpense(app.ctx, { amount: 100_000, category: 'wants' });
    const id = await lastId(app, 'expense');
    const before = await state(app);
    expect((await editDescription(app.ctx, id, { note: 'Dinner', expenseCategory: 'needs' })).ok).toBe(true);
    const after = await state(app);
    expect(after.snapshot.transactions.find((t) => t.id === id)).toMatchObject({ note: 'Dinner', expenseCategory: 'needs', amount: 100_000 });
    expect(after.personal).toBe(before.personal);
    expect(after.snapshot.transactions).toHaveLength(before.snapshot.transactions.length);
    await editDescription(app.ctx, id, { note: null });
    expect((await state(app)).snapshot.transactions.find((t) => t.id === id)!.note).toBeUndefined();
  });

  it('refuses a missing record', async () => {
    const app = await onboardedApp();
    expect(await editDescription(app.ctx, 'nope', { note: 'x' })).toMatchObject({ ok: false });
  });
});
