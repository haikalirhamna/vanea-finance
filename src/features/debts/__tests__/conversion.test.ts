import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { onboardedApp } from '../../__tests__/helpers';
import { recordExpense } from '../../spending/spending-actions';
import { addCreditLine } from '../debts-actions';
import { convertPurchase, convertiblePurchases } from '../conversion-actions';

async function paylaterWithPurchase() {
  const app = await onboardedApp({}, '2026-10-01');
  const line = await addCreditLine(app.ctx, { name: 'PayLater', type: 'paylater', statementDay: 5, dueDay: 25 });
  const debtId = line.ok ? line.value.id : '';
  app.setToday('2026-10-09');
  await recordExpense(app.ctx, { amount: 1_200_000, category: 'wants', creditLineId: debtId, date: '2026-10-02', note: 'Headphones' });
  const purchase = convertiblePurchases((await app.snapshot()).transactions, debtId)[0]!;
  return { app, debtId, purchase };
}

const bal = async (app: Awaited<ReturnType<typeof onboardedApp>>, account: 'personal' | 'bill_reserve') =>
  balanceOf(allMovements((await app.snapshot()).transactions), account);

describe('convertPurchase', () => {
  it('returns the reserved money, moves the debt to a new loan and keeps the expense at its full price', async () => {
    const { app, debtId, purchase } = await paylaterWithPurchase();
    expect(await bal(app, 'bill_reserve')).toBe(1_200_000);
    const personalBefore = await bal(app, 'personal');
    const result = await convertPurchase(app.ctx, { debtId, purchaseId: purchase.id, installmentAmount: 450_000, installmentCount: 3, firstDueDate: '2026-11-05' });
    expect(result.ok).toBe(true);
    expect(await bal(app, 'bill_reserve')).toBe(0);
    expect(await bal(app, 'personal')).toBe(personalBefore + 1_200_000);
    const snapshot = await app.snapshot();
    const loan = snapshot.debts.find((d) => d.origin === 'conversion')!;
    expect(loan).toMatchObject({ type: 'paylater_installments', amountReceived: 1_200_000, installmentAmount: 450_000, installmentCount: 3, status: 'open' });
    expect(snapshot.transactions.find((t) => t.id === purchase.id)).toMatchObject({ amount: 1_200_000 });
    expect(convertiblePurchases(snapshot.transactions, debtId)).toEqual([]);
  });

  it('refuses installments that repay less than the price, and a purchase converted twice', async () => {
    const { app, debtId, purchase } = await paylaterWithPurchase();
    const terms = { debtId, purchaseId: purchase.id, installmentAmount: 300_000, installmentCount: 3, firstDueDate: '2026-11-05' };
    expect(await convertPurchase(app.ctx, terms)).toMatchObject({ ok: false });
    await convertPurchase(app.ctx, { ...terms, installmentAmount: 450_000 });
    expect(await convertPurchase(app.ctx, { ...terms, installmentAmount: 450_000 })).toMatchObject({ ok: false, error: { title: 'That purchase is not available' } });
  });
});

describe('addCreditLine with an existing balance', () => {
  it('records what is owed and can reserve it from Available Spending', async () => {
    const app = await onboardedApp();
    const line = await addCreditLine(app.ctx, { name: 'PayLater', type: 'paylater', statementDay: 5, dueDay: 25, existingBalance: 800_000, setAside: true });
    expect(line.ok).toBe(true);
    expect(await bal(app, 'bill_reserve')).toBe(800_000);
    expect(await bal(app, 'personal')).toBe(4_250_000 - 800_000);
  });

  it('keeps an older balance out of Available Spending when not set aside', async () => {
    const app = await onboardedApp();
    await addCreditLine(app.ctx, { name: 'Card', type: 'credit_card', statementDay: 5, dueDay: 25, existingBalance: 800_000, setAside: false });
    expect(await bal(app, 'bill_reserve')).toBe(0);
    expect(await bal(app, 'personal')).toBe(4_250_000);
  });
});
