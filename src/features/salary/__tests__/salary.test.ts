import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { insertAdvance, loadAdvances } from '@/data/salary';
import { TestApp, onboardedApp } from '../../__tests__/helpers';
import { recordIncome } from '../../income/income-actions';
import { paySalary } from '../salary-actions';
import { salaryIsDue, salaryState } from '../salary-state';

async function balances(app: TestApp) {
  const movements = allMovements((await app.snapshot()).transactions);
  return { pool: balanceOf(movements, 'pool'), personal: balanceOf(movements, 'personal') };
}

async function stateOf(app: TestApp) {
  return salaryState(await app.snapshot(), app.ctx.today());
}

const advance = (over: object = {}) => ({
  id: 'adv', amount: 3_000_000, termPeriods: 3, installmentAmount: 1_000_000, firstPeriod: '2026-10',
  origin: 'manual' as const, status: 'active' as const, ...over,
});

describe('salaryState', () => {
  it('has no salary before the first salary period begins', async () => {
    const app = await onboardedApp();
    const state = await stateOf(app);
    expect(state).toMatchObject({ period: '2026-09', salary: null, payment: null, advance: null });
    expect(salaryIsDue(state)).toBe(false);
  });

  it('owes the full salary on payday', async () => {
    const app = await onboardedApp();
    app.setToday('2026-10-25');
    const state = await stateOf(app);
    expect(state).toMatchObject({ period: '2026-10', salary: 4_700_000 });
    expect(state.payment).toMatchObject({ entitlement: 4_700_000, remaining: 4_700_000, hasPayment: false });
    expect(salaryIsDue(state)).toBe(true);
  });

  it('shows an active advance and what is withheld', async () => {
    const app = await onboardedApp();
    await insertAdvance(app.driver, advance(), app.ctx.now());
    app.setToday('2026-10-25');
    const state = await stateOf(app);
    expect(state.advance?.outstanding).toBe(3_000_000);
    expect(state.payment).toMatchObject({ installmentWithheld: 1_000_000, entitlement: 3_700_000 });
  });
});

describe('paySalary', () => {
  it('moves the salary from the Pool to Available Spending', async () => {
    const app = await onboardedApp();
    app.setToday('2026-10-25');
    expect(await paySalary(app.ctx, { amount: 4_700_000 })).toEqual({ ok: true, value: { period: '2026-10', paid: 4_700_000, installment: 0 } });
    expect(await balances(app)).toEqual({ pool: 14_000_000 - 4_700_000, personal: 4_250_000 + 4_700_000 });
    expect(salaryIsDue(await stateOf(app))).toBe(false);
  });

  it('refuses before the first salary period, and once the period is fully paid', async () => {
    const app = await onboardedApp();
    expect(await paySalary(app.ctx, { amount: 1_000_000 })).toMatchObject({ ok: false, error: { title: 'No salary to pay yet' } });
    app.setToday('2026-10-25');
    await paySalary(app.ctx, { amount: 4_700_000 });
    expect(await paySalary(app.ctx, { amount: 1 })).toMatchObject({ ok: false, error: { title: 'This period is fully paid' } });
  });

  it('explains a Pool that is too small, as in DESIGN §12', async () => {
    const app = await onboardedApp({ salary: 8_000_000, openingBalances: { pool: 3_500_000, personal: 0, savings: 0 } });
    app.setToday('2026-10-25');
    expect(await paySalary(app.ctx, { amount: 5_000_000 })).toEqual({
      ok: false,
      error: {
        title: 'Not enough in your Pool',
        what: 'You want to pay yourself Rp 5.000.000, but your Pool has Rp 3.500.000.',
        next: 'You can pay Rp 3.500.000 now and the rest later this period if more income arrives.',
      },
    });
    expect(await balances(app)).toEqual({ pool: 3_500_000, personal: 0 });
  });

  it('allows a partial payment, then a top-up when more income arrives', async () => {
    const app = await onboardedApp({ salary: 8_000_000, openingBalances: { pool: 3_500_000, personal: 0, savings: 0 } });
    app.setToday('2026-10-25');
    expect((await paySalary(app.ctx, { amount: 3_500_000 })).ok).toBe(true);
    expect((await balances(app)).pool).toBe(0);
    expect((await stateOf(app)).payment).toMatchObject({ paid: 3_500_000, remaining: 4_500_000 });
    await recordIncome(app.ctx, { amount: 2_000_000 });
    expect((await paySalary(app.ctx, { amount: 2_000_000 })).ok).toBe(true);
    expect((await stateOf(app)).payment?.remaining).toBe(2_500_000);
  });

  it('never pays more than the salary, whatever the Pool holds', async () => {
    const app = await onboardedApp();
    app.setToday('2026-10-25');
    expect(await paySalary(app.ctx, { amount: 4_700_001 })).toMatchObject({
      ok: false, error: { title: "That's more than this period's salary", next: 'Pay up to Rp 4.700.000.' },
    });
  });

  it('rejects zero and fractional amounts', async () => {
    const app = await onboardedApp();
    app.setToday('2026-10-25');
    expect(await paySalary(app.ctx, { amount: 0 })).toMatchObject({ ok: false, error: { title: 'Check the amount' } });
    expect(await paySalary(app.ctx, { amount: 100.5 })).toMatchObject({ ok: false });
  });

  describe('with a salary advance', () => {
    it('withholds the installment on the first payment and nothing on a top-up', async () => {
      const app = await onboardedApp();
      await insertAdvance(app.driver, advance(), app.ctx.now());
      app.setToday('2026-10-25');
      expect(await paySalary(app.ctx, { amount: 3_000_000 })).toMatchObject({ ok: true, value: { installment: 1_000_000 } });
      const first = (await app.snapshot()).transactions.at(-1)!;
      expect(first).toMatchObject({ advanceInstallment: 1_000_000, advanceId: 'adv' });
      expect(await paySalary(app.ctx, { amount: 700_000 })).toMatchObject({ ok: true, value: { installment: 0 } });
      expect((await app.snapshot()).transactions.at(-1)!.advanceId).toBeUndefined();
      expect((await stateOf(app)).advance?.outstanding).toBe(2_000_000);
      expect((await stateOf(app)).payment?.remaining).toBe(0);
    });

    it('marks the advance repaid with the last installment', async () => {
      const app = await onboardedApp();
      await insertAdvance(app.driver, advance({ amount: 1_000_000, termPeriods: 1 }), app.ctx.now());
      app.setToday('2026-10-25');
      expect((await paySalary(app.ctx, { amount: 3_700_000 })).ok).toBe(true);
      expect((await loadAdvances(app.driver))[0]!.status).toBe('repaid');
      expect((await stateOf(app)).advance).toBeNull();
    });

    it('records a zero payment when the whole salary is withheld', async () => {
      const app = await onboardedApp({ salary: 1_000_000 });
      await insertAdvance(app.driver, advance({ amount: 1_000_000, termPeriods: 1 }), app.ctx.now());
      app.setToday('2026-10-25');
      const state = await stateOf(app);
      expect(state.payment).toMatchObject({ entitlement: 0, installmentWithheld: 1_000_000 });
      expect(salaryIsDue(state)).toBe(true);
      expect(await paySalary(app.ctx, { amount: 0 })).toMatchObject({ ok: true, value: { paid: 0, installment: 1_000_000 } });
      expect((await loadAdvances(app.driver))[0]!.status).toBe('repaid');
      expect((await balances(app)).pool).toBe(14_000_000);
      expect(salaryIsDue(await stateOf(app))).toBe(false);
    });

    it('does not withhold before the advance starts', async () => {
      const app = await onboardedApp();
      await insertAdvance(app.driver, advance({ firstPeriod: '2026-11' }), app.ctx.now());
      app.setToday('2026-10-25');
      expect(await paySalary(app.ctx, { amount: 4_700_000 })).toMatchObject({ ok: true, value: { installment: 0 } });
    });
  });
});
