import { onboardedApp } from '../../__tests__/helpers';
import { recordExpense } from '../../spending/spending-actions';
import { paySalary } from '../../salary/salary-actions';
import { saveReflection, setIntention } from '../reflection-actions';
import { figuresFor, monthPrompts, pastMonths, savedFigures } from '../reflection-summary';

async function appWithOctober() {
  const app = await onboardedApp();
  app.setToday('2026-10-26');
  await paySalary(app.ctx, { amount: 4_700_000 });
  app.setToday('2026-10-28');
  await recordExpense(app.ctx, { amount: 300_000, category: 'needs', date: '2026-10-27' });
  await recordExpense(app.ctx, { amount: 150_000, category: 'wants', date: '2026-10-28' });
  return app;
}

describe('intention', () => {
  it('is set once a month and replaces the earlier one', async () => {
    const app = await onboardedApp();
    await setIntention(app.ctx, { setAsideAmount: 1_000_000, wantsLimit: 500_000, note: 'save' });
    await setIntention(app.ctx, { setAsideAmount: 800_000 });
    const { intentions } = await app.snapshot();
    expect(intentions).toHaveLength(1);
    expect(intentions[0]).toMatchObject({ month: '2026-10', setAsideAmount: 800_000 });
    expect(intentions[0]!.wantsLimit).toBeUndefined();
  });

  it('refuses a negative amount', async () => {
    const app = await onboardedApp();
    expect(await setIntention(app.ctx, { setAsideAmount: -1 })).toMatchObject({ ok: false });
  });
});

describe('reflection', () => {
  it('pre-fills received and spent by category, with intention against actual', async () => {
    const app = await appWithOctober();
    app.setToday('2026-10-20');
    await setIntention(app.ctx, { setAsideAmount: 1_000_000, wantsLimit: 100_000 });
    const figures = figuresFor(await app.snapshot(), '2026-10');
    expect(figures.summary).toMatchObject({ received: 4_700_000, totalSpent: 450_000, spent: { needs: 300_000, wants: 150_000 } });
    expect(figures.intention).toMatchObject({ setAsideIntended: 1_000_000, wantsOverLimit: true });
  });

  it('is saved with the numbers as they were, and cannot be saved twice', async () => {
    const app = await appWithOctober();
    app.setToday('2026-11-03');
    expect(await saveReflection(app.ctx, { month: '2026-10', notes: { improveNote: 'Cook more', wantsNote: '  ' } })).toMatchObject({ ok: true });
    app.setToday('2026-11-20');
    await recordExpense(app.ctx, { amount: 50_000, category: 'needs', date: '2026-10-30' }).catch(() => undefined);
    const snapshot = await app.snapshot();
    const saved = snapshot.reflections[0]!;
    expect(saved).toMatchObject({ month: '2026-10', improveNote: 'Cook more' });
    expect(saved.wantsNote).toBeUndefined();
    expect(savedFigures(saved.summarySnapshotJson).summary.totalSpent).toBe(450_000);
    expect(await saveReflection(app.ctx, { month: '2026-10', notes: {} })).toMatchObject({ ok: false, error: { title: 'Already reflected' } });
  });

  it("refuses a month that isn't over", async () => {
    const app = await appWithOctober();
    expect(await saveReflection(app.ctx, { month: '2026-10', notes: {} })).toMatchObject({ ok: false, error: { title: "This month isn't over" } });
  });
});

describe('monthPrompts', () => {
  it('invites a reflection on last month and an intention for this one, until done', async () => {
    const app = await appWithOctober();
    app.setToday('2026-11-03');
    expect(monthPrompts(await app.snapshot(), '2026-11-03')).toEqual({ reflectOn: '2026-10', needsIntention: true });
    await setIntention(app.ctx, { setAsideAmount: 0 });
    await saveReflection(app.ctx, { month: '2026-10', notes: {} });
    expect(monthPrompts(await app.snapshot(), '2026-11-03')).toEqual({ reflectOn: null, needsIntention: false });
  });

  it('has nothing to reflect on in the month of onboarding', async () => {
    const app = await onboardedApp();
    expect(monthPrompts(await app.snapshot(), '2026-10-09').reflectOn).toBeNull();
  });

  it('lists the months since onboarding, newest first', async () => {
    const app = await onboardedApp();
    expect(pastMonths(await app.snapshot(), '2027-01-05')).toEqual(['2026-12', '2026-11', '2026-10']);
  });
});
