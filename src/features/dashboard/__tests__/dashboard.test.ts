import { insertSubscription } from '@/data/subscriptions';
import { TestApp, onboardedApp } from '../../__tests__/helpers';
import { addCreditLine, addLoan } from '../../debts/debts-actions';
import { recordIncome } from '../../income/income-actions';
import { paySalary } from '../../salary/salary-actions';
import { recordExpense } from '../../spending/spending-actions';
import { buildDashboard } from '../dashboard-summary';
import { planNotifications } from '../notification-plan';

async function summaryOf(app: TestApp) {
  return buildDashboard(await app.snapshot(), app.ctx.today());
}

const KREDIVO = {
  name: 'Kredivo', type: 'online_loan' as const, purpose: 'personal' as const, use: 'cash' as const, received: 3_000_000,
  installmentAmount: 550_000, installmentCount: 6, frequency: 'monthly' as const, firstDueDate: '2026-10-20',
};

describe('buildDashboard', () => {
  it('shows the hero numbers right after setting up, before the first payday', async () => {
    const app = await onboardedApp();
    const summary = await summaryOf(app);
    expect(summary.availableSpending).toBe(4_250_000);
    expect(summary.allowance).toMatchObject({ nextPayday: '2026-10-25', daysLeft: 16, amount: 265_625, overspent: false, salaryDueToday: false });
    expect(summary.salary).toMatchObject({ amount: null, due: false, remaining: 0, startsOn: '2026-10-25', nextPayday: '2026-10-25' });
    expect(summary.pool).toMatchObject({ balance: 14_000_000, own: 14_000_000, runwayMonths: null, commitment: 0 });
    expect(summary.pressure.level).toBe('NONE');
    expect(summary.recentSpending).toEqual([]);
    expect(summary.debts).toMatchObject({ totalOwed: 0, dueBeforePayday: 0, ratio: null, showRatioCard: false });
  });

  it('asks for the salary on payday, with the runway from salary and commitments', async () => {
    const app = await onboardedApp();
    app.setToday('2026-10-25');
    const summary = await summaryOf(app);
    expect(summary.salary).toMatchObject({ amount: 4_700_000, due: true, remaining: 4_700_000, payableNow: 4_700_000, withheld: 0 });
    expect(summary.allowance.salaryDueToday).toBe(true);
    expect(summary.pool.runwayMonths).toBeCloseTo(14_000_000 / 4_700_000, 6);
    await paySalary(app.ctx, { amount: 4_700_000 });
    const after = await summaryOf(app);
    expect(after.salary.due).toBe(false);
    expect(after.availableSpending).toBe(8_950_000);
    expect(after.pool.balance).toBe(9_300_000);
  });

  it('limits what can be paid now to the Pool', async () => {
    const app = await onboardedApp({ salary: 8_000_000, openingBalances: { pool: 3_500_000, personal: 0, savings: 0 } });
    app.setToday('2026-10-25');
    expect((await summaryOf(app)).salary).toMatchObject({ remaining: 8_000_000, payableNow: 3_500_000 });
  });

  it('goes overspent without refusing the expense', async () => {
    const app = await onboardedApp();
    await recordExpense(app.ctx, { amount: 4_550_000, category: 'wants' });
    expect(await summaryOf(app)).toMatchObject({ availableSpending: -300_000, allowance: { amount: null, overspent: true } });
  });

  it('sets aside installments due before payday from the daily allowance', async () => {
    const app = await onboardedApp();
    await addLoan(app.ctx, KREDIVO);
    const summary = await summaryOf(app);
    expect(summary.availableSpending).toBe(4_250_000 + 3_000_000);
    expect(summary.debts).toMatchObject({ totalOwed: 3_300_000, dueBeforePayday: 550_000, dueThisMonth: 550_000 });
    expect(summary.allowance).toMatchObject({ dueBeforePayday: 550_000, amount: Math.floor((7_250_000 - 550_000) / 16) });
  });

  it('shows the debt payment ratio card only above 30% of salary', async () => {
    const app = await onboardedApp({ salary: 1_500_000 });
    await addLoan(app.ctx, { ...KREDIVO, installmentAmount: 600_000, received: 3_000_000 });
    app.setToday('2026-10-25');
    const summary = await summaryOf(app);
    expect(summary.debts.ratio).toBeCloseTo(0.4, 6);
    expect(summary.debts.showRatioCard).toBe(true);
    const calm = await onboardedApp({ salary: 8_000_000 });
    await addLoan(calm.ctx, KREDIVO);
    calm.setToday('2026-10-25');
    expect((await summaryOf(calm)).debts.showRatioCard).toBe(false);
  });

  it('lists recent spending, newest first, marking credit line purchases', async () => {
    const app = await onboardedApp({}, '2026-10-01');
    const line = await addCreditLine(app.ctx, { name: 'PayLater', type: 'paylater', statementDay: 5, dueDay: 25 });
    app.setToday('2026-10-09');
    await recordExpense(app.ctx, { amount: 230_000, category: 'needs', note: 'Groceries', date: '2026-10-05' });
    await recordExpense(app.ctx, { amount: 45_000, category: 'wants', note: 'Coffee', date: '2026-10-08' });
    await recordExpense(app.ctx, { amount: 300_000, category: 'wants', creditLineId: line.ok ? line.value.id : '', date: '2026-10-08' });
    const recent = (await summaryOf(app)).recentSpending;
    expect(recent.map((r) => r.label)).toEqual(['Coffee', 'Expense', 'Groceries']);
    expect(recent.find((r) => r.amount === 300_000)?.paidWithCreditLine).toBe(true);
    expect(recent[0]).toMatchObject({ category: 'wants', date: '2026-10-08', paidWithCreditLine: false });
  });

  it('keeps only the five most recent', async () => {
    const app = await onboardedApp();
    for (let i = 1; i <= 7; i += 1) await recordExpense(app.ctx, { amount: i * 1_000, category: 'needs' });
    expect((await summaryOf(app)).recentSpending).toHaveLength(5);
  });

  it('adds subscriptions to the monthly commitments: yearly ones divided by 12', async () => {
    const app = await onboardedApp();
    const now = app.ctx.now();
    await app.driver.transaction(async () => {
      await insertSubscription(app.driver, { id: 'a', name: 'Figma', cycle: 'monthly', nextBillingDate: '2026-11-15', prices: [{ price: 225_000, effectiveFrom: '2026-01-15' }] }, now);
      await insertSubscription(app.driver, { id: 'b', name: 'Adobe', cycle: 'yearly', nextBillingDate: '2027-03-03', prices: [{ price: 2_400_000, effectiveFrom: '2026-03-03' }] }, now);
    });
    app.setToday('2026-10-25');
    expect((await summaryOf(app)).pool.commitment).toBe(4_700_000 + 225_000 + 200_000);
  });

  it('keeps business loan money out of the own Pool and adds its installment to the commitments', async () => {
    const app = await onboardedApp();
    await addLoan(app.ctx, { ...KREDIVO, purpose: 'business', use: 'cash' });
    app.setToday('2026-10-25');
    const summary = await summaryOf(app);
    expect(summary.pool).toMatchObject({ balance: 17_000_000, own: 14_000_000, commitment: 4_700_000 + 550_000 });
  });

  it('warns calmly when salary outruns income and the Pool is thin', async () => {
    const lean = Array.from({ length: 12 }, (_, i) => ({ month: `${i < 3 ? 2025 : 2026}-${String(((i + 9) % 12) + 1).padStart(2, '0')}`, amount: 3_000_000 }));
    const app = await onboardedApp({ historical: lean, openingBalances: { pool: 5_000_000, personal: 0, savings: 0 } });
    app.setToday('2026-10-25');
    const { pressure } = await summaryOf(app);
    expect(pressure).toMatchObject({ level: 'SERIOUS', typicalIncome: 3_000_000 });
    expect(pressure.monthsToEmpty).toBeCloseTo(5_000_000 / 1_700_000, 6);
    expect(pressure.safeSalary).not.toBeNull();
    expect(pressure.safeSalary!).toBeLessThan(4_700_000);
  });

  it('knows spending pace once there is money in the period', async () => {
    const app = await onboardedApp({ salary: 4_700_000 });
    app.setToday('2026-10-25');
    await paySalary(app.ctx, { amount: 4_700_000 });
    await recordIncome(app.ctx, { amount: 1 });
    await recordExpense(app.ctx, { amount: 6_000_000, category: 'wants' });
    const pace = (await summaryOf(app)).pace;
    expect(pace?.ahead).toBe(true);
    expect(pace?.spentRatio).toBeGreaterThan(0.5);
  });
});

describe('planNotifications', () => {
  it('reminds about the next two paydays at 09:00 with the salary for that period', async () => {
    const app = await onboardedApp();
    const plan = planNotifications(await app.snapshot(), '2026-10-09');
    expect(plan.filter((n) => n.id.startsWith('payday'))).toEqual([
      { id: 'payday:2026-10-25', at: '2026-10-25T09:00', title: 'Payday', body: "Payday. Pay yourself Rp 4.700.000 when you're ready." },
      { id: 'payday:2026-11-25', at: '2026-11-25T09:00', title: 'Payday', body: "Payday. Pay yourself Rp 4.700.000 when you're ready." },
    ]);
  });

  it('reminds on the day each installment and bill falls due, soonest first', async () => {
    const app = await onboardedApp({}, '2026-10-01');
    await addLoan(app.ctx, KREDIVO);
    const line = await addCreditLine(app.ctx, { name: 'PayLater', type: 'paylater', statementDay: 5, dueDay: 25 });
    app.setToday('2026-10-09');
    await recordExpense(app.ctx, { amount: 1_200_000, category: 'wants', creditLineId: line.ok ? line.value.id : '', date: '2026-10-02' });
    const plan = planNotifications(await app.snapshot(), '2026-10-09');
    const first = plan.filter((n) => n.id.startsWith('debt'));
    expect(first[0]).toMatchObject({ at: '2026-10-20T09:00', title: 'Installment due', body: 'Your Kredivo installment of Rp 550.000 is due today.' });
    expect(first[1]).toMatchObject({ at: '2026-10-25T09:00', title: 'Bill due', body: 'Your PayLater bill is due today: Rp 1.200.000. Rp 1.200.000 is already set aside.' });
    expect([...plan].map((n) => n.at)).toEqual([...plan].map((n) => n.at).sort());
  });

  it('sends at most one serious-pressure reminder a month, on the 15th', async () => {
    const lean = Array.from({ length: 12 }, (_, i) => ({ month: `${i < 3 ? 2025 : 2026}-${String(((i + 9) % 12) + 1).padStart(2, '0')}`, amount: 3_000_000 }));
    const app = await onboardedApp({ historical: lean, openingBalances: { pool: 5_000_000, personal: 0, savings: 0 } });
    const snapshot = await app.snapshot();
    const pressure = (today: string) => planNotifications(snapshot, today).filter((n) => n.id.startsWith('pressure'));
    expect(pressure('2026-11-09').map((n) => n.at)).toEqual(['2026-11-15T09:00']);
    expect(pressure('2026-11-09')).toEqual(pressure('2026-11-12'));
    expect(pressure('2026-11-20').map((n) => n.at)).toEqual(['2026-12-15T09:00']);
  });

  it('reminds on the first of next month to reflect, and about a stale backup once a month', async () => {
    const app = await onboardedApp();
    const plan = planNotifications(await app.snapshot(), '2026-10-09');
    expect(plan.find((n) => n.id === 'month:2026-11')).toMatchObject({ at: '2026-11-01T09:00', title: 'A new month' });
    expect(plan.find((n) => n.id.startsWith('backup'))).toMatchObject({ id: 'backup:2026-11', at: '2026-11-05T09:00' });
    const backedUp = { ...(await app.snapshot()) };
    backedUp.profile = { ...backedUp.profile!, lastExportAt: '2026-10-01T08:00:00.000Z' };
    expect(planNotifications(backedUp, '2026-10-09').some((n) => n.id.startsWith('backup'))).toBe(false);
  });

  it('leaves out reminders that are switched off, and anything already past', async () => {
    const app = await onboardedApp({}, '2026-10-01');
    await addLoan(app.ctx, { ...KREDIVO, firstDueDate: '2026-10-05' });
    app.setToday('2026-10-09');
    const snapshot = await app.snapshot();
    expect(planNotifications(snapshot, '2026-10-09').some((n) => n.at.startsWith('2026-10-05'))).toBe(false);
    const off = { ...snapshot, profile: { ...snapshot.profile!, notify: { payday: false, subscriptions: false, debts: false, month: false, pressure: false, backup: false } } };
    expect(planNotifications(off, '2026-10-09')).toEqual([]);
  });
});
