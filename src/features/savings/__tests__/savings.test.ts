import { CONFIG } from '@/domain/config';
import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { onboardedApp } from '../../__tests__/helpers';
import { createAdvance, repayAdvanceEarly } from '../../salary/advance-actions';
import { paySalary } from '../../salary/salary-actions';
import { allocateSurplus, depositSavings, runwayAfterMove, surplusView, withdrawSavings } from '../savings-actions';

const balances = async (app: Awaited<ReturnType<typeof onboardedApp>>) => {
  const movements = allMovements((await app.snapshot()).transactions);
  return { pool: balanceOf(movements, 'pool'), personal: balanceOf(movements, 'personal'), savings: balanceOf(movements, 'savings') };
};

describe('savings', () => {
  it('moves between Available Spending and Savings, and never below zero', async () => {
    const app = await onboardedApp();
    expect(await depositSavings(app.ctx, { amount: 1_000_000 })).toMatchObject({ ok: true });
    expect(await balances(app)).toMatchObject({ personal: 3_250_000, savings: 3_000_000 });
    expect(await withdrawSavings(app.ctx, { amount: 500_000 })).toMatchObject({ ok: true });
    expect(await withdrawSavings(app.ctx, { amount: 9_000_000 })).toMatchObject({ ok: false });
    expect(await balances(app)).toMatchObject({ personal: 3_750_000, savings: 2_500_000 });
  });
});

describe('Pool surplus', () => {
  it('shows the safe surplus and moves money to savings', async () => {
    const app = await onboardedApp({ openingBalances: { pool: 40_000_000, personal: 4_250_000, savings: 2_000_000 } });
    app.setToday('2026-10-25');
    const view = surplusView(await app.snapshot(), '2026-10-25');
    expect(view.pool).toBe(40_000_000);
    expect(view.safe).toBe(40_000_000 - CONFIG.DEFAULT_BUFFER_MONTHS * 4_700_000);
    expect(await allocateSurplus(app.ctx, { amount: 1_000_000, target: { to: 'savings' } })).toMatchObject({ ok: true });
    expect(await balances(app)).toMatchObject({ pool: 39_000_000, savings: 3_000_000 });
  });

  it('has no safe surplus while the Pool is below the buffer', async () => {
    const app = await onboardedApp();
    app.setToday('2026-10-25');
    expect(surplusView(await app.snapshot(), '2026-10-25').safe).toBe(0);
  });

  it('allows a move above the safe surplus but shows a shorter runway first', async () => {
    const app = await onboardedApp();
    app.setToday('2026-10-25');
    const snapshot = await app.snapshot();
    const before = surplusView(snapshot, '2026-10-25').runwayNow!;
    const after = runwayAfterMove(snapshot, '2026-10-25', 8_000_000)!;
    expect(after).toBeLessThan(before);
    expect(await allocateSurplus(app.ctx, { amount: 8_000_000, target: { to: 'savings' } })).toMatchObject({ ok: true });
  });

  it('refuses more than the Pool holds', async () => {
    const app = await onboardedApp();
    expect(await allocateSurplus(app.ctx, { amount: 99_000_000, target: { to: 'savings' } })).toMatchObject({ ok: false });
  });
});

describe('salary advance', () => {
  async function paidApp() {
    const app = await onboardedApp();
    app.setToday('2026-10-25');
    return app;
  }

  it('moves money from the Pool to Available Spending and lowers the next salaries', async () => {
    const app = await paidApp();
    expect(await createAdvance(app.ctx, { amount: 3_000_000, termPeriods: 3 })).toMatchObject({ ok: true });
    expect(await balances(app)).toMatchObject({ pool: 11_000_000, personal: 7_250_000 });
    const advance = (await app.snapshot()).advances[0]!;
    expect(advance).toMatchObject({ installmentAmount: 1_000_000, termPeriods: 3, status: 'active' });
    const paid = await paySalary(app.ctx, { amount: 3_700_000 });
    expect(paid).toMatchObject({ ok: true });
  });

  it('allows only one at a time, at most one salary, and no more than the Pool', async () => {
    const app = await paidApp();
    expect(await createAdvance(app.ctx, { amount: 5_000_000, termPeriods: 3 })).toMatchObject({ ok: false, error: { title: 'That is more than your salary' } });
    expect(await createAdvance(app.ctx, { amount: 1_000_000, termPeriods: 7 })).toMatchObject({ ok: false, error: { title: 'Choose 1 to 6 salaries' } });
    await createAdvance(app.ctx, { amount: 1_000_000, termPeriods: 2 });
    expect(await createAdvance(app.ctx, { amount: 1_000_000, termPeriods: 2 })).toMatchObject({ ok: false, error: { title: 'You already have an advance' } });
  });

  it('can be repaid early, and is marked repaid when nothing is left', async () => {
    const app = await paidApp();
    await createAdvance(app.ctx, { amount: 2_000_000, termPeriods: 2 });
    expect(await repayAdvanceEarly(app.ctx, { amount: 5_000_000 })).toMatchObject({ ok: false, error: { title: "That's more than you owe" } });
    expect(await repayAdvanceEarly(app.ctx, { amount: 500_000 })).toMatchObject({ ok: true });
    expect(await repayAdvanceEarly(app.ctx, { amount: 1_500_000 })).toMatchObject({ ok: true });
    expect((await app.snapshot()).advances[0]!.status).toBe('repaid');
    expect(await balances(app)).toMatchObject({ pool: 14_000_000, personal: 4_250_000 });
  });
});
