import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { amountsOf, netIncomeSeries } from '@/domain/income-history';
import { onboardedApp } from '../../__tests__/helpers';
import { recordBusinessCost } from '../business-actions';
import { recordIncome } from '../../income/income-actions';

describe('recordBusinessCost', () => {
  it('takes the full amount out of the Pool on the payment date', async () => {
    const app = await onboardedApp();
    expect((await recordBusinessCost(app.ctx, { amount: 2_400_000, category: 'subscription', billingCycle: 'yearly', label: 'Figma' })).ok).toBe(true);
    const snapshot = await app.snapshot();
    expect(balanceOf(allMovements(snapshot.transactions), 'pool')).toBe(14_000_000 - 2_400_000);
    expect(snapshot.transactions.at(-1)).toMatchObject({ kind: 'business_cost', billingCycle: 'yearly', label: 'Figma' });
  });

  it('always asks monthly or yearly for a subscription', async () => {
    const app = await onboardedApp();
    expect(await recordBusinessCost(app.ctx, { amount: 225_000, category: 'subscription' })).toMatchObject({
      ok: false, error: { title: 'Is it monthly or yearly?', next: 'Choose monthly or yearly.' },
    });
    expect((await app.snapshot()).transactions.filter((t) => t.kind === 'business_cost')).toEqual([]);
  });

  it('asks nothing extra for other categories, and does not store a stray cycle', async () => {
    const app = await onboardedApp();
    expect((await recordBusinessCost(app.ctx, { amount: 500_000, category: 'tools', billingCycle: 'yearly' })).ok).toBe(true);
    expect((await app.snapshot()).transactions.at(-1)!.billingCycle).toBeUndefined();
  });

  it('is limited by the Pool, with the usual explanation', async () => {
    const app = await onboardedApp();
    expect(await recordBusinessCost(app.ctx, { amount: 20_000_000, category: 'tax' })).toMatchObject({
      ok: false, error: { title: 'Not enough in your Pool', what: 'This would leave your Pool short by Rp 6.000.000 on 9 Oct.' },
    });
  });

  it('reduces net income: a yearly subscription is spread over 12 months', async () => {
    const app = await onboardedApp({ openingBalances: { pool: 0, personal: 0, savings: 0 }, historical: [] }, '2026-01-10');
    await recordIncome(app.ctx, { amount: 6_000_000 });
    await recordBusinessCost(app.ctx, { amount: 2_400_000, category: 'subscription', billingCycle: 'yearly' });
    app.setToday('2026-04-02');
    const snapshot = await app.snapshot();
    const series = netIncomeSeries(snapshot.transactions, snapshot.historicalMonths, '2026-04-02');
    expect(amountsOf(series)).toEqual([6_000_000 - 200_000, -200_000, -200_000]);
  });
});
