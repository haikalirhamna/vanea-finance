import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { onboardedApp } from '../../__tests__/helpers';
import { recordIncome } from '../income-actions';

const pool = async (app: Awaited<ReturnType<typeof onboardedApp>>) => balanceOf(allMovements((await app.snapshot()).transactions), 'pool');

describe('recordIncome', () => {
  it('adds the amount to the Pool, dated today by default', async () => {
    const app = await onboardedApp();
    expect(await recordIncome(app.ctx, { amount: 3_000_000, source: 'Client A', note: 'Logo' })).toEqual({ ok: true, value: undefined });
    expect(await pool(app)).toBe(17_000_000);
    const income = (await app.snapshot()).transactions.at(-1)!;
    expect(income).toMatchObject({ kind: 'income', date: '2026-10-09', source: 'Client A', note: 'Logo' });
  });

  it('accepts an earlier date since onboarding', async () => {
    const app = await onboardedApp();
    expect((await recordIncome(app.ctx, { amount: 100_000, date: '2026-10-09' })).ok).toBe(true);
  });

  it('refuses dates before onboarding, in the future, and bad amounts, with an explanation', async () => {
    const app = await onboardedApp();
    expect(await recordIncome(app.ctx, { amount: 1_000, date: '2026-09-30' })).toMatchObject({
      ok: false, error: { title: 'That is before you started', next: 'Older income belongs in Income history, in Settings.' },
    });
    expect(await recordIncome(app.ctx, { amount: 1_000, date: '2026-10-10' })).toMatchObject({ ok: false, error: { title: "That date hasn't come yet" } });
    expect(await recordIncome(app.ctx, { amount: 0 })).toMatchObject({ ok: false, error: { title: 'Check the amount' } });
    expect(await recordIncome(app.ctx, { amount: 10.5 })).toMatchObject({ ok: false });
    expect(await pool(app)).toBe(14_000_000);
  });
});
