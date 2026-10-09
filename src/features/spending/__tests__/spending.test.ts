import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { insertDebt } from '@/data/debts';
import { onboardedApp } from '../../__tests__/helpers';
import { recordExpense } from '../spending-actions';

const NOW = '2026-10-09T08:00:00.000Z';

describe('recordExpense', () => {
  it('lowers Available Spending and keeps the category', async () => {
    const app = await onboardedApp();
    expect((await recordExpense(app.ctx, { amount: 230_000, category: 'needs', note: 'Groceries' })).ok).toBe(true);
    const snapshot = await app.snapshot();
    expect(balanceOf(allMovements(snapshot.transactions), 'personal')).toBe(4_250_000 - 230_000);
    expect(snapshot.transactions.at(-1)).toMatchObject({ kind: 'expense', expenseCategory: 'needs', note: 'Groceries' });
  });

  it('is never blocked: spending more than Available Spending just shows overspent', async () => {
    const app = await onboardedApp();
    expect((await recordExpense(app.ctx, { amount: 5_000_000, category: 'wants' })).ok).toBe(true);
    expect(balanceOf(allMovements((await app.snapshot()).transactions), 'personal')).toBe(-750_000);
  });

  describe('with a credit line', () => {
    async function withPayLater() {
      const app = await onboardedApp();
      await insertDebt(app.driver, { id: 'pl', kind: 'credit_line', name: 'PayLater', type: 'paylater', purpose: 'personal', statementDay: 5, dueDay: 25, origin: 'manual', status: 'open' }, NOW);
      return app;
    }

    it('takes the money out of Available Spending now and sets it aside for the bill', async () => {
      const app = await withPayLater();
      expect((await recordExpense(app.ctx, { amount: 300_000, category: 'wants', creditLineId: 'pl' })).ok).toBe(true);
      const movements = allMovements((await app.snapshot()).transactions);
      expect(balanceOf(movements, 'personal')).toBe(4_250_000 - 300_000);
      expect(balanceOf(movements, 'bill_reserve', 'pl')).toBe(300_000);
      expect(balanceOf(movements, 'debt', 'pl')).toBe(300_000);
    });

    it('refuses a line that is closed or missing', async () => {
      const app = await withPayLater();
      expect(await recordExpense(app.ctx, { amount: 1_000, category: 'wants', creditLineId: 'nope' })).toMatchObject({ ok: false, error: { title: 'That credit line is not available' } });
      await app.driver.run("UPDATE debts SET status = 'closed' WHERE id = 'pl'");
      expect((await recordExpense(app.ctx, { amount: 1_000, category: 'wants', creditLineId: 'pl' })).ok).toBe(false);
    });

    it('refuses a loan used as if it were a credit line', async () => {
      const app = await withPayLater();
      await insertDebt(app.driver, { id: 'ln', kind: 'installment_loan', name: 'Loan', type: 'online_loan', purpose: 'personal', amountReceived: 1_000_000, installmentAmount: 100_000, installmentCount: 10, frequency: 'monthly', firstDueDate: '2026-11-01', origin: 'manual', status: 'open' }, NOW);
      expect((await recordExpense(app.ctx, { amount: 1_000, category: 'wants', creditLineId: 'ln' })).ok).toBe(false);
    });
  });
});
