import { availableSpending, dailyAllowance, paceStatus } from '../spending';
import { expense, opening, salaryPayment, tx } from './helpers/builders';

describe('availableSpending', () => {
  it('is the personal balance: salary in, expenses out, and it may be negative', () => {
    const book = [opening('personal', 1_000_000), salaryPayment(8_000_000, '2026-09', '2026-09-25'), expense(2_000_000, '2026-10-01')];
    expect(availableSpending([opening('pool', 20_000_000), ...book])).toBe(7_000_000);
    expect(availableSpending([expense(300_000, '2026-02-01')])).toBe(-300_000);
  });

  it('does not count savings or investments', () => {
    const book = [opening('personal', 5_000_000), tx('savings_deposit', 1_000_000), tx('investment_contribution', 500_000)];
    expect(availableSpending(book)).toBe(3_500_000);
  });
});

describe('dailyAllowance', () => {
  const base = { today: '2026-10-09', paydayDay: 25, entitlementUnpaid: false };

  it('spreads Available Spending over the days until payday', () => {
    expect(dailyAllowance({ ...base, available: 4_250_000 })).toEqual({
      nextPayday: '2026-10-25', daysLeft: 16, amount: 265_625, overspent: false, salaryDueToday: false,
    });
  });

  it('rounds down to a whole rupiah', () => {
    expect(dailyAllowance({ ...base, available: 1_000_000 }).amount).toBe(62_500);
    expect(dailyAllowance({ ...base, available: 1_000_001 }).amount).toBe(62_500);
  });

  it('has no daily figure while overspent', () => {
    expect(dailyAllowance({ ...base, available: -300_000 })).toMatchObject({ amount: null, overspent: true });
    expect(dailyAllowance({ ...base, available: 0 })).toMatchObject({ amount: null, overspent: true });
  });

  it('counts at least one day, and looks to next month on payday itself', () => {
    const onPayday = dailyAllowance({ ...base, today: '2026-10-25', available: 3_000_000, entitlementUnpaid: true });
    expect(onPayday).toMatchObject({ nextPayday: '2026-11-25', daysLeft: 31, salaryDueToday: true });
    expect(dailyAllowance({ ...base, today: '2026-10-24', available: 100 }).daysLeft).toBe(1);
  });

  it('flags salary due only on payday and only when unpaid', () => {
    expect(dailyAllowance({ ...base, available: 1, entitlementUnpaid: true }).salaryDueToday).toBe(false);
    expect(dailyAllowance({ ...base, today: '2026-10-25', available: 1 }).salaryDueToday).toBe(false);
  });
});

describe('paceStatus', () => {
  const paydayDay = 1;
  const book = [salaryPayment(8_000_000, '2026-10', '2026-10-01')];

  it('has no pace without money to spend this period', () => {
    expect(paceStatus([expense(100, '2026-10-02')], '2026-10-10', paydayDay)).toBeNull();
  });

  it('is ahead when spending outruns the calendar by more than 15 points', () => {
    const result = paceStatus([...book, expense(4_000_000, '2026-10-05')], '2026-10-10', paydayDay)!;
    expect(result.spentRatio).toBeCloseTo(0.5, 10);
    expect(result.elapsedRatio).toBeCloseTo(10 / 31, 10);
    expect(result.ahead).toBe(true);
  });

  it('stays quiet within 15 points of the calendar', () => {
    const result = paceStatus([...book, expense(2_000_000, '2026-10-05')], '2026-10-10', paydayDay)!;
    expect(result.ahead).toBe(false);
  });

  it('counts money carried over from earlier periods in the budget', () => {
    const carried = [salaryPayment(8_000_000, '2026-09', '2026-09-01'), ...book, expense(1_000_000, '2026-10-05')];
    expect(paceStatus(carried, '2026-10-10', paydayDay)!.spentRatio).toBeCloseTo(1_000_000 / 16_000_000, 10);
  });

  it('ignores spending from before the period started', () => {
    const earlier = [...book, expense(3_000_000, '2026-09-20'), expense(800_000, '2026-10-05')];
    expect(paceStatus(earlier, '2026-10-10', paydayDay)!.spentRatio).toBeCloseTo(800_000 / (8_000_000 - 3_000_000), 10);
  });
});
