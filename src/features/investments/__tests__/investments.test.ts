import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { onboardedApp } from '../../__tests__/helpers';
import { buildDashboard } from '../../dashboard/dashboard-summary';
import {
  addHolding, addHoldingIncome, contribute, previewSale, recordExistingPutIn, sell, updateValue, withdrawHoldingCash,
} from '../investment-actions';
import { investmentsView, netPosition } from '../investment-summary';

async function withHolding(assetClass: 'stock' | 'time_deposit' = 'stock') {
  const app = await onboardedApp();
  const added = await addHolding(app.ctx, { name: 'BBCA', assetClass });
  if (!added.ok) throw new Error('setup');
  return { app, id: added.value.id };
}

const bal = async (app: Awaited<ReturnType<typeof onboardedApp>>, account: 'pool' | 'personal' | 'savings') =>
  balanceOf(allMovements((await app.snapshot()).transactions), account);

describe('holdings', () => {
  it('needs a name, and a risk label for "other"', async () => {
    const app = await onboardedApp();
    expect(await addHolding(app.ctx, { name: ' ', assetClass: 'stock' })).toMatchObject({ ok: false });
    expect(await addHolding(app.ctx, { name: 'Art', assetClass: 'other' })).toMatchObject({ ok: false, error: { title: 'Set a risk label' } });
    expect(await addHolding(app.ctx, { name: 'Art', assetClass: 'other', riskOverride: 'high' })).toMatchObject({ ok: true });
  });

  it('puts money in from Available Spending or from the Pool, never beyond what is there', async () => {
    const { app, id } = await withHolding();
    expect(await contribute(app.ctx, { holdingId: id, amount: 1_000_000, from: 'personal' })).toMatchObject({ ok: true });
    expect(await contribute(app.ctx, { holdingId: id, amount: 2_000_000, from: 'pool' })).toMatchObject({ ok: true });
    expect(await bal(app, 'personal')).toBe(3_250_000);
    expect(await bal(app, 'pool')).toBe(12_000_000);
    expect(investmentsView(await app.snapshot(), '2026-10-09').holdings[0]!.putIn).toBe(3_000_000);
    expect(await contribute(app.ctx, { holdingId: id, amount: 99_000_000, from: 'personal' })).toMatchObject({ ok: false });
  });

  it('counts an investment owned before Vanea as put in, without touching any money', async () => {
    const { app, id } = await withHolding();
    await recordExistingPutIn(app.ctx, { holdingId: id, amount: 5_000_000 });
    expect(await bal(app, 'personal')).toBe(4_250_000);
    expect(investmentsView(await app.snapshot(), '2026-10-09').totals.putIn).toBe(5_000_000);
  });
});

describe('estimates', () => {
  it('are dated, shown as secondary, and never change any money or the dashboard', async () => {
    const { app, id } = await withHolding();
    await recordExistingPutIn(app.ctx, { holdingId: id, amount: 4_000_000 });
    const before = buildDashboard(await app.snapshot(), '2026-10-09');
    await updateValue(app.ctx, { holdingId: id, value: 4_600_000 });
    const snapshot = await app.snapshot();
    expect(buildDashboard(snapshot, '2026-10-09')).toEqual(before);
    const row = investmentsView(snapshot, '2026-10-09').holdings[0]!;
    expect(row.estimate).toEqual({ value: 4_600_000, asOf: '2026-10-09', stale: false, onPaper: 600_000 });
  });

  it('are flagged after 90 days and replaced when the same date is updated', async () => {
    const { app, id } = await withHolding();
    await recordExistingPutIn(app.ctx, { holdingId: id, amount: 1_000_000 });
    await updateValue(app.ctx, { holdingId: id, value: 1_100_000 });
    await updateValue(app.ctx, { holdingId: id, value: 1_200_000 });
    const snapshot = await app.snapshot();
    expect(snapshot.holdings[0]!.valuations).toHaveLength(1);
    expect(investmentsView(snapshot, '2027-02-01').holdings[0]!.estimate).toMatchObject({ value: 1_200_000, stale: true });
  });

  it('refuse a future date', async () => {
    const { app, id } = await withHolding();
    expect(await updateValue(app.ctx, { holdingId: id, value: 1, asOf: '2027-01-01' })).toMatchObject({ ok: false });
  });
});

describe('selling', () => {
  it('previews the cost removed and the realized gain', () => {
    expect(previewSale(4_000_000, { proceeds: 4_600_000, share: 'all' })).toEqual({ costRemoved: 4_000_000, realizedGain: 600_000 });
    expect(previewSale(4_000_000, { proceeds: 1_200_000, share: 0.25 })).toEqual({ costRemoved: 1_000_000, realizedGain: 200_000 });
  });

  it('sends the cash to the chosen account, lowers put in by the cost, and closes a fully sold holding', async () => {
    const { app, id } = await withHolding();
    await recordExistingPutIn(app.ctx, { holdingId: id, amount: 4_000_000 });
    expect(await sell(app.ctx, { holdingId: id, proceeds: 4_600_000, share: 'all', to: 'savings' })).toMatchObject({ ok: true });
    expect(await bal(app, 'savings')).toBe(2_000_000 + 4_600_000);
    const snapshot = await app.snapshot();
    expect(snapshot.holdings[0]!.status).toBe('closed');
    expect(investmentsView(snapshot, '2026-10-09').totals.putIn).toBe(0);
  });

  it('a partial sale keeps the holding open', async () => {
    const { app, id } = await withHolding();
    await recordExistingPutIn(app.ctx, { holdingId: id, amount: 4_000_000 });
    await sell(app.ctx, { holdingId: id, proceeds: 1_200_000, share: 0.25, to: 'personal' });
    const view = investmentsView(await app.snapshot(), '2026-10-09');
    expect(view.holdings[0]).toMatchObject({ status: 'open', putIn: 3_000_000 });
    expect(await bal(app, 'personal')).toBe(4_250_000 + 1_200_000);
  });
});

describe('income and net position', () => {
  it('keeps dividends with the holding until they are withdrawn', async () => {
    const { app, id } = await withHolding();
    await addHoldingIncome(app.ctx, { holdingId: id, amount: 150_000 });
    expect(await bal(app, 'personal')).toBe(4_250_000);
    expect(investmentsView(await app.snapshot(), '2026-10-09').holdings[0]!.cash).toBe(150_000);
    await withdrawHoldingCash(app.ctx, { holdingId: id, amount: 100_000, to: 'personal' });
    expect(await bal(app, 'personal')).toBe(4_350_000);
    expect(await withdrawHoldingCash(app.ctx, { holdingId: id, amount: 100_000, to: 'personal' })).toMatchObject({ ok: false });
  });

  it('shows money, investments and debts as three separate groups', async () => {
    const { app, id } = await withHolding();
    await recordExistingPutIn(app.ctx, { holdingId: id, amount: 4_000_000 });
    await updateValue(app.ctx, { holdingId: id, value: 4_600_000 });
    expect(netPosition(await app.snapshot(), '2026-10-09')).toEqual({
      money: { pool: 14_000_000, personal: 4_250_000, savings: 2_000_000, total: 20_250_000 },
      investments: { putIn: 4_000_000, estimatedValue: 4_600_000 },
      debts: 0,
    });
  });

  it('notes a concentration in a high-risk class over half of what was put in', async () => {
    const { app, id } = await withHolding('stock');
    const safe = await addHolding(app.ctx, { name: 'Deposito', assetClass: 'time_deposit' });
    await recordExistingPutIn(app.ctx, { holdingId: id, amount: 6_000_000 });
    await recordExistingPutIn(app.ctx, { holdingId: safe.ok ? safe.value.id : '', amount: 2_000_000 });
    expect(investmentsView(await app.snapshot(), '2026-10-09').concentrated).toMatchObject({ assetClass: 'stock' });
  });
});
