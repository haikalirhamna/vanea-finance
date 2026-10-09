import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { BASIC_ONBOARDING, STEADY_HISTORY, onboardedApp, testApp } from '../../__tests__/helpers';
import { completeOnboarding, firstSalaryPeriod } from '../onboarding-actions';
import { recommendForOnboarding } from '../onboarding-recommendation';

describe('firstSalaryPeriod', () => {
  it('is the next payday\'s month, or this month when today is payday', () => {
    expect(firstSalaryPeriod('2026-10-09', 25)).toBe('2026-10');
    expect(firstSalaryPeriod('2026-10-25', 25)).toBe('2026-10');
    expect(firstSalaryPeriod('2026-10-26', 25)).toBe('2026-11');
    expect(firstSalaryPeriod('2026-12-30', 25)).toBe('2027-01');
  });
});

describe('recommendForOnboarding', () => {
  it('uses completed months and the opening Pool', () => {
    const result = recommendForOnboarding(STEADY_HISTORY, 0, '2026-10-09');
    expect(result.monthsOfData).toBe(12);
    expect(result.recommendation?.amount).toBe(4_750_000);
  });

  it('has no recommendation with fewer than three months', () => {
    expect(recommendForOnboarding(STEADY_HISTORY.slice(-2), 5_000_000, '2026-10-09').recommendation).toBeNull();
    expect(recommendForOnboarding([], 0, '2026-10-09')).toEqual({ recommendation: null, monthsOfData: 0 });
  });

  it('ignores the current, incomplete month', () => {
    const withCurrent = [...STEADY_HISTORY, { month: '2026-10', amount: 900_000 }];
    expect(recommendForOnboarding(withCurrent, 0, '2026-10-09').monthsOfData).toBe(12);
  });
});

describe('completeOnboarding', () => {
  it('saves the profile, history, opening balances and first salary', async () => {
    const app = await onboardedApp();
    const snapshot = await app.snapshot();
    expect(snapshot.profile).toMatchObject({ paydayDay: 25, onboardedOn: '2026-10-09', calibrationUntilPeriod: '2026-12', bufferMonths: 3, appLockEnabled: true });
    expect(snapshot.historicalMonths).toHaveLength(12);
    expect(snapshot.salarySettings).toEqual([expect.objectContaining({ amount: 4_700_000, effectivePeriod: '2026-10', changeType: 'initial', recommendedAmount: 4_750_000 })]);
    const movements = allMovements(snapshot.transactions);
    expect(balanceOf(movements, 'pool')).toBe(14_000_000);
    expect(balanceOf(movements, 'personal')).toBe(4_250_000);
    expect(balanceOf(movements, 'savings')).toBe(2_000_000);
  });

  it('does not count historical income as Pool money', async () => {
    const app = await onboardedApp({ openingBalances: { pool: 0, personal: 0, savings: 0 } });
    const snapshot = await app.snapshot();
    expect(snapshot.transactions).toEqual([]);
    expect(await app.driver.all('SELECT * FROM movements')).toEqual([]);
  });

  it('starts the first salary this month when onboarding on payday', async () => {
    const app = await onboardedApp({}, '2026-10-25');
    expect((await app.snapshot()).salarySettings[0]!.effectivePeriod).toBe('2026-10');
    const later = await onboardedApp({}, '2026-10-26');
    expect((await later.snapshot()).salarySettings[0]!.effectivePeriod).toBe('2026-11');
  });

  it('records a credit line balance and sets it aside from Available Spending by default', async () => {
    const app = await onboardedApp({
      debts: [{ kind: 'credit_line', name: 'PayLater', type: 'paylater', statementDay: 5, dueDay: 25, balance: 1_500_000, setAside: true }],
    });
    const snapshot = await app.snapshot();
    const line = snapshot.debts[0]!;
    expect(line).toMatchObject({ kind: 'credit_line', name: 'PayLater', origin: 'onboarding', statementDay: 5, dueDay: 25 });
    const movements = allMovements(snapshot.transactions);
    expect(balanceOf(movements, 'debt', line.id)).toBe(1_500_000);
    expect(balanceOf(movements, 'bill_reserve', line.id)).toBe(1_500_000);
    expect(balanceOf(movements, 'personal')).toBe(4_250_000 - 1_500_000);
  });

  it('can treat an existing balance as older debt, leaving Available Spending alone', async () => {
    const app = await onboardedApp({
      debts: [{ kind: 'credit_line', name: 'Card', type: 'credit_card', statementDay: 20, dueDay: 5, balance: 900_000, setAside: false, creditLimit: 5_000_000 }],
    });
    const snapshot = await app.snapshot();
    const movements = allMovements(snapshot.transactions);
    expect(balanceOf(movements, 'bill_reserve')).toBe(0);
    expect(balanceOf(movements, 'personal')).toBe(4_250_000);
    expect(snapshot.debts[0]!.creditLimit).toBe(5_000_000);
  });

  it('records a loan with the installments still to pay', async () => {
    const app = await onboardedApp({
      debts: [{ kind: 'installment_loan', name: 'Kredivo', type: 'online_loan', purpose: 'personal', installmentAmount: 550_000, remainingInstallments: 5, nextDueDate: '2026-11-02' }],
    });
    const snapshot = await app.snapshot();
    const loan = snapshot.debts[0]!;
    expect(loan).toMatchObject({ kind: 'installment_loan', installmentAmount: 550_000, installmentCount: 5, firstDueDate: '2026-11-02', frequency: 'monthly' });
    expect(balanceOf(allMovements(snapshot.transactions), 'debt', loan.id)).toBe(2_750_000);
    expect(balanceOf(allMovements(snapshot.transactions), 'personal')).toBe(4_250_000);
  });

  it('refuses invalid input and writes nothing', async () => {
    const cases = [
      { paydayDay: 29 }, { paydayDay: 0 }, { salary: 0 }, { salary: 1.5 },
      { openingBalances: { pool: -1, personal: 0, savings: 0 } },
    ];
    for (const input of cases) {
      const app = await testApp();
      const result = await completeOnboarding(app.ctx, { ...BASIC_ONBOARDING, ...input });
      expect(result.ok).toBe(false);
      expect((await app.snapshot()).profile).toBeNull();
    }
  });

  it('rolls everything back when a step is refused halfway', async () => {
    const app = await testApp();
    const result = await completeOnboarding(app.ctx, {
      ...BASIC_ONBOARDING,
      debts: [{ kind: 'credit_line', name: 'Card', type: 'credit_card', statementDay: 5, dueDay: 25, balance: 10.5, setAside: true }],
    });
    expect(result).toMatchObject({ ok: false, error: { title: 'Check the amount' } });
    const snapshot = await app.snapshot();
    expect(snapshot.profile).toBeNull();
    expect(snapshot.debts).toEqual([]);
    expect(snapshot.salarySettings).toEqual([]);
    expect(snapshot.historicalMonths).toEqual([]);
  });

  it('refuses to run twice', async () => {
    const app = await onboardedApp();
    const again = await completeOnboarding(app.ctx, BASIC_ONBOARDING);
    expect(again).toMatchObject({ ok: false, error: { title: 'Already set up' } });
    expect((await app.snapshot()).salarySettings).toHaveLength(1);
  });
});
