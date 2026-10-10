import { salaryFor } from '@/domain/salary-change';
import { TestApp, onboardedApp } from '../../__tests__/helpers';
import { paySalary } from '../salary-actions';
import { recordIncome } from '../../income/income-actions';
import { acceptRaise, declineRaise, decreaseSalary, ensureMonthlyReview, restoreSalary } from '../salary-review-actions';
import { previewSalaryChange, salaryHistory, salaryOptions } from '../salary-review';

const STEADY_3M = Array.from({ length: 12 }, (_, i) => ({
  month: `${i < 3 ? 2025 : 2026}-${String(((i + 9) % 12) + 1).padStart(2, '0')}`, amount: 3_000_000,
}));

/** Income that steps up from 3 to 4,5 million: a real shift, so the review becomes ELIGIBLE in May 2027. */
async function appWithRaiseEligible(): Promise<TestApp> {
  const app = await onboardedApp({ historical: STEADY_3M, salary: 2_500_000 });
  for (const month of ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']) {
    app.setToday(`${month}-20`);
    await recordIncome(app.ctx, { amount: month < '2027-01' ? 3_000_000 : 4_500_000 });
  }
  app.setToday('2027-05-10');
  return app;
}

async function salaryNow(app: TestApp): Promise<number | null> {
  const snapshot = await app.snapshot();
  return salaryFor(snapshot.salarySettings, salaryOptions(snapshot, app.ctx.today()).period);
}

describe('monthly review', () => {
  it('stores one snapshot per month and offers an eligible raise', async () => {
    const app = await appWithRaiseEligible();
    await ensureMonthlyReview(app.ctx);
    await ensureMonthlyReview(app.ctx);
    const { evaluations } = await app.snapshot();
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]).toMatchObject({ evaluatedMonth: '2027-05', status: 'ELIGIBLE', decision: 'none', currentSalary: 2_500_000, maxNewSalary: 2_620_000 });
  });

  it('expires a review nobody acted on when the next month starts', async () => {
    const app = await appWithRaiseEligible();
    await ensureMonthlyReview(app.ctx);
    app.setToday('2027-06-10');
    await ensureMonthlyReview(app.ctx);
    const { evaluations } = await app.snapshot();
    expect(evaluations.map((e) => [e.evaluatedMonth, e.decision])).toEqual([['2027-06', 'none'], ['2027-05', 'expired']]);
  });

  it('is not eligible right after the first salary: no raise can be taken', async () => {
    const app = await onboardedApp();
    app.setToday('2026-11-02');
    await ensureMonthlyReview(app.ctx);
    const { evaluations } = await app.snapshot();
    expect(evaluations[0]!.status).not.toBe('ELIGIBLE');
    const result = await acceptRaise(app.ctx, { amount: 4_900_000 });
    expect(result).toMatchObject({ ok: false, error: { title: 'No raise is available' } });
    expect(await declineRaise(app.ctx)).toMatchObject({ ok: false });
  });
});

describe('raises', () => {
  it('accepts the maximum and records the decision', async () => {
    const app = await appWithRaiseEligible();
    await ensureMonthlyReview(app.ctx);
    expect(await acceptRaise(app.ctx, { amount: 2_620_000 })).toEqual({ ok: true, value: undefined });
    const snapshot = await app.snapshot();
    expect(snapshot.salarySettings.at(-1)).toMatchObject({ amount: 2_620_000, changeType: 'increase' });
    expect(snapshot.evaluations[0]).toMatchObject({ decision: 'accepted', finalSalary: 2_620_000 });
    expect(await salaryNow(app)).toBe(2_620_000);
  });

  it('accepts a smaller raise', async () => {
    const app = await appWithRaiseEligible();
    await ensureMonthlyReview(app.ctx);
    await acceptRaise(app.ctx, { amount: 2_550_000 });
    expect((await app.snapshot()).evaluations[0]).toMatchObject({ decision: 'accepted_smaller', finalSalary: 2_550_000 });
  });

  it('refuses more than the maximum and explains the limit', async () => {
    const app = await appWithRaiseEligible();
    await ensureMonthlyReview(app.ctx);
    const result = await acceptRaise(app.ctx, { amount: 2_700_000 });
    expect(result).toMatchObject({ ok: false, error: { title: 'That is above the limit' } });
    expect((await app.snapshot()).salarySettings).toHaveLength(1);
  });

  it('keeps the salary when the raise is declined, and cannot be accepted afterwards', async () => {
    const app = await appWithRaiseEligible();
    await ensureMonthlyReview(app.ctx);
    expect(await declineRaise(app.ctx)).toMatchObject({ ok: true });
    expect((await app.snapshot()).evaluations[0]!.decision).toBe('declined');
    expect(await acceptRaise(app.ctx, { amount: 2_600_000 })).toMatchObject({ ok: false });
    expect(await salaryNow(app)).toBe(2_500_000);
  });
});

describe('decrease and restore', () => {
  it('decreases without any gate and can return up to the old salary', async () => {
    const app = await onboardedApp();
    app.setToday('2026-10-26');
    await paySalary(app.ctx, { amount: 4_700_000 });
    expect(await decreaseSalary(app.ctx, { amount: 4_000_000 })).toMatchObject({ ok: true });
    expect(await salaryNow(app)).toBe(4_000_000);
    expect(salaryOptions(await app.snapshot(), app.ctx.today()).restoreTo).toBe(4_700_000);
    expect(await restoreSalary(app.ctx, { amount: 4_300_000 })).toMatchObject({ ok: true });
    expect(await salaryNow(app)).toBe(4_300_000);
  });

  it('refuses a restore above the highest salary of the last 12 months', async () => {
    const app = await onboardedApp();
    await decreaseSalary(app.ctx, { amount: 4_000_000 });
    const result = await restoreSalary(app.ctx, { amount: 5_000_000 });
    expect(result).toMatchObject({ ok: false, error: { title: "That's above what you can restore" } });
  });

  it('refuses a "decrease" that is not lower', async () => {
    const app = await onboardedApp();
    expect(await decreaseSalary(app.ctx, { amount: 4_900_000 })).toMatchObject({ ok: false, error: { title: 'That is not a decrease' } });
  });

  it('shows how a lower salary lengthens the Pool', async () => {
    const app = await onboardedApp();
    const preview = previewSalaryChange(await app.snapshot(), app.ctx.today(), 3_500_000);
    expect(preview.runwayAfter!).toBeGreaterThan(preview.runwayBefore!);
  });

  it('lists every change, newest first', async () => {
    const app = await onboardedApp();
    await decreaseSalary(app.ctx, { amount: 4_000_000 });
    expect(salaryHistory(await app.snapshot()).map((h) => [h.type, h.amount])).toEqual([['decrease', 4_000_000], ['initial', 4_700_000]]);
  });
});
