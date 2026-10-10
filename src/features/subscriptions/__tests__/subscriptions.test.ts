import { activeTransactions } from '@/domain/ledger';
import { onboardedApp } from '../../__tests__/helpers';
import { addSubscription, announcePriceChange, confirmBilling, editSubscription, removeSubscription, skipBilling } from '../subscription-actions';
import { previewPriceChange, subscriptionList } from '../subscription-summary';
import { planNotifications } from '../../dashboard/notification-plan';

const FIGMA = { name: 'Figma', cycle: 'monthly' as const, price: 225_000, nextBillingDate: '2026-10-12' };

async function withFigma() {
  const app = await onboardedApp();
  const added = await addSubscription(app.ctx, FIGMA);
  if (!added.ok) throw new Error('setup');
  return { app, id: added.value.id };
}

describe('subscriptions', () => {
  it('adds, lists with the monthly equivalent, edits and deletes', async () => {
    const { app, id } = await withFigma();
    await addSubscription(app.ctx, { name: 'Hosting', cycle: 'yearly', price: 1_200_000, nextBillingDate: '2027-02-01' });
    let list = subscriptionList(await app.snapshot(), '2026-10-09');
    expect(list.rows.map((r) => [r.name, r.monthly])).toEqual([['Figma', 225_000], ['Hosting', 100_000]]);
    expect(list.monthlyTotal).toBe(325_000);
    await editSubscription(app.ctx, id, { name: 'Figma Pro', nextBillingDate: '2026-10-20' });
    expect((await app.snapshot()).subscriptions.find((s) => s.id === id)).toMatchObject({ name: 'Figma Pro', nextBillingDate: '2026-10-20' });
    expect(await removeSubscription(app.ctx, id)).toMatchObject({ ok: true });
    list = subscriptionList(await app.snapshot(), '2026-10-09');
    expect(list.rows.map((r) => r.name)).toEqual(['Hosting']);
  });

  it('refuses a missing name or price', async () => {
    const app = await onboardedApp();
    expect(await addSubscription(app.ctx, { ...FIGMA, name: ' ' })).toMatchObject({ ok: false, error: { title: 'Give it a name' } });
    expect(await addSubscription(app.ctx, { ...FIGMA, price: 0 })).toMatchObject({ ok: false, error: { title: 'Check the price' } });
  });
});

describe('billing', () => {
  it('records the cost with the subscription, and moves the next date one cycle on', async () => {
    const { app, id } = await withFigma();
    app.setToday('2026-10-12');
    expect(await confirmBilling(app.ctx, { id, amount: 225_000 })).toMatchObject({ ok: true });
    const snapshot = await app.snapshot();
    const cost = activeTransactions(snapshot.transactions).find((t) => t.kind === 'business_cost');
    expect(cost).toMatchObject({ amount: 225_000, businessCostCategory: 'subscription', billingCycle: 'monthly', label: 'Figma', subscriptionId: id });
    expect(snapshot.subscriptions[0]!.nextBillingDate).toBe('2026-11-12');
  });

  it('asks "Did the price change?" when the amount differs, and records nothing until answered', async () => {
    const { app, id } = await withFigma();
    app.setToday('2026-10-12');
    const asked = await confirmBilling(app.ctx, { id, amount: 250_000 });
    expect(asked).toMatchObject({ ok: false, error: { title: 'Did the price change?' } });
    expect((await app.snapshot()).transactions.filter((t) => t.kind === 'business_cost')).toHaveLength(0);
    await confirmBilling(app.ctx, { id, amount: 250_000, choice: 'from_now_on' });
    const after = subscriptionList(await app.snapshot(), '2026-10-12').rows[0]!;
    expect(after).toMatchObject({ price: 250_000, monthly: 250_000 });
    expect(after.change).toMatchObject({ percent: 11 });
  });

  it('keeps the price when the user says it was only this time', async () => {
    const { app, id } = await withFigma();
    app.setToday('2026-10-12');
    await confirmBilling(app.ctx, { id, amount: 250_000, choice: 'only_this_time' });
    expect(subscriptionList(await app.snapshot(), '2026-10-12').rows[0]!.price).toBe(225_000);
  });

  it('skips a billing without recording anything', async () => {
    const { app, id } = await withFigma();
    await skipBilling(app.ctx, id);
    const snapshot = await app.snapshot();
    expect(snapshot.subscriptions[0]!.nextBillingDate).toBe('2026-11-12');
    expect(snapshot.transactions.filter((t) => t.kind === 'business_cost')).toHaveLength(0);
  });

  it('keeps a yearly cost already paid after the subscription is deleted', async () => {
    const { app } = await withFigma();
    const yearly = await addSubscription(app.ctx, { name: 'Hosting', cycle: 'yearly', price: 1_200_000, nextBillingDate: '2026-10-09' });
    await confirmBilling(app.ctx, { id: yearly.ok ? yearly.value.id : '', amount: 1_200_000 });
    await removeSubscription(app.ctx, yearly.ok ? yearly.value.id : '');
    const cost = (await app.snapshot()).transactions.find((t) => t.label === 'Hosting')!;
    expect(cost.subscriptionId).toBeUndefined();
  });
});

describe('announced price changes', () => {
  it('apply from their date, leave today alone, and show the impact first', async () => {
    const { app, id } = await withFigma();
    await announcePriceChange(app.ctx, { id, price: 250_000, effectiveFrom: '2026-12-01' });
    const snapshot = await app.snapshot();
    expect(subscriptionList(snapshot, '2026-10-09').rows[0]).toMatchObject({ price: 225_000, upcoming: { price: 250_000, effectiveFrom: '2026-12-01' } });
    expect(subscriptionList(snapshot, '2026-12-01').rows[0]!.price).toBe(250_000);
    const impact = previewPriceChange(snapshot, '2026-10-09', id, 250_000)!;
    expect(impact.monthlyDelta).toBe(25_000);
    expect(impact.commitmentAfter - impact.commitmentBefore).toBe(25_000);
  });
});

describe('reminders', () => {
  it('reminds on the billing date with the price for that date', async () => {
    const { app, id } = await withFigma();
    await announcePriceChange(app.ctx, { id, price: 250_000, effectiveFrom: '2026-10-12' });
    const plan = planNotifications(await app.snapshot(), '2026-10-09').filter((n) => n.id.startsWith('subscription'));
    expect(plan).toEqual([{ id: `subscription:${id}:2026-10-12`, at: '2026-10-12T09:00', title: 'Subscription renews', body: 'Figma renews today: Rp 250.000.' }]);
  });
});
