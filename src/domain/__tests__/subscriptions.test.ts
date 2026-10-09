import {
  applyPriceChoice, monthlyEquivalent, monthlyEquivalents, needsPriceQuestion, nextBillingDate, priceAt,
  priceChangeImpact, priceChangeSince, spreadCharge,
} from '../subscriptions';
import { sum } from '../money';

const history = [
  { price: 225_000, effectiveFrom: '2026-01-15' },
  { price: 252_000, effectiveFrom: '2026-06-15' },
];

describe('priceAt', () => {
  it('uses the latest price effective on or before the date', () => {
    expect(priceAt(history, '2026-01-14')).toBeNull();
    expect(priceAt(history, '2026-01-15')).toBe(225_000);
    expect(priceAt(history, '2026-06-14')).toBe(225_000);
    expect(priceAt(history, '2026-06-15')).toBe(252_000);
    expect(priceAt([...history].reverse(), '2026-07-01')).toBe(252_000);
  });

  it('shows an announced future price only once its date arrives', () => {
    const announced = [...history, { price: 300_000, effectiveFrom: '2027-01-01' }];
    expect(priceAt(announced, '2026-12-31')).toBe(252_000);
    expect(priceAt(announced, '2027-01-01')).toBe(300_000);
  });
});

describe('monthlyEquivalent', () => {
  it('divides a yearly price by 12, rounded down', () => {
    expect(monthlyEquivalent('monthly', 225_000)).toBe(225_000);
    expect(monthlyEquivalent('yearly', 2_400_000)).toBe(200_000);
    expect(monthlyEquivalent('yearly', 1_000_000)).toBe(83_333);
  });

  it('lists every subscription at its price on the date, leaving out those without a price yet', () => {
    const subscriptions = [
      { cycle: 'monthly' as const, prices: history },
      { cycle: 'yearly' as const, prices: [{ price: 2_400_000, effectiveFrom: '2026-03-01' }] },
      { cycle: 'monthly' as const, prices: [{ price: 50_000, effectiveFrom: '2027-01-01' }] },
    ];
    expect(monthlyEquivalents(subscriptions, '2026-07-01')).toEqual([252_000, 200_000]);
  });
});

describe('spreadCharge', () => {
  it('puts a monthly charge in the month paid', () => {
    expect(spreadCharge(225_000, 'monthly', '2026-10')).toEqual([{ month: '2026-10', amount: 225_000 }]);
  });

  it('spreads a yearly charge over 12 months starting with the month paid (PRD example)', () => {
    const shares = spreadCharge(2_400_000, 'yearly', '2026-10');
    expect(shares).toHaveLength(12);
    expect(shares[0]).toEqual({ month: '2026-10', amount: 200_000 });
    expect(shares[11]).toEqual({ month: '2027-09', amount: 200_000 });
  });

  it('gives the rounding remainder to the first month (PRD example: Rp 1.000.000)', () => {
    const shares = spreadCharge(1_000_000, 'yearly', '2026-10');
    expect(shares[0]!.amount).toBe(83_337);
    expect(shares.slice(1).every((s) => s.amount === 83_333)).toBe(true);
  });

  it.each([1, 11, 12, 100, 999_999, 2_400_001])('always adds up exactly (amount %i)', (amount) => {
    expect(sum(spreadCharge(amount, 'yearly', '2026-02').map((s) => s.amount))).toBe(amount);
  });
});

describe('nextBillingDate', () => {
  it('advances one cycle keeping the day of month', () => {
    expect(nextBillingDate('2026-10-15', 'monthly')).toBe('2026-11-15');
    expect(nextBillingDate('2026-10-15', 'yearly')).toBe('2027-10-15');
    expect(nextBillingDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  it('clamps to the end of a short month, then returns to the original day', () => {
    const february = nextBillingDate('2026-01-31', 'monthly');
    expect(february).toBe('2026-02-28');
    expect(nextBillingDate(february, 'monthly', 31)).toBe('2026-03-31');
  });

  it('handles a yearly subscription renewing on 29 February', () => {
    expect(nextBillingDate('2028-02-29', 'yearly')).toBe('2029-02-28');
  });
});

describe('price questions at confirmation', () => {
  it('asks only when the amount differs from the saved price', () => {
    expect(needsPriceQuestion(225_000, 225_000)).toBe(false);
    expect(needsPriceQuestion(225_000, 250_000)).toBe(true);
    expect(needsPriceQuestion(null, 250_000)).toBe(false);
  });

  it('"from now on" adds a price effective from the billing date', () => {
    expect(applyPriceChoice(history, '2026-07-15', 270_000, 'from_now_on')).toEqual([...history, { price: 270_000, effectiveFrom: '2026-07-15' }]);
  });

  it('replaces a price already set for the same date', () => {
    const result = applyPriceChoice(history, '2026-06-15', 260_000, 'from_now_on');
    expect(result).toEqual([history[0], { price: 260_000, effectiveFrom: '2026-06-15' }]);
  });

  it('"only this time" changes nothing', () => {
    expect(applyPriceChoice(history, '2026-07-15', 270_000, 'only_this_time')).toEqual(history);
  });
});

describe('priceChangeImpact', () => {
  it('shows the new commitment and runway (PRD example)', () => {
    const impact = priceChangeImpact({ oldMonthly: 225_000, newMonthly: 250_000, commitment: 8_700_000, ownPool: 24_000_000 });
    expect(impact.monthlyDelta).toBe(25_000);
    expect(impact.commitmentAfter).toBe(8_725_000);
    expect(impact.runwayBefore!).toBeCloseTo(2.76, 2);
    expect(impact.runwayAfter!).toBeCloseTo(2.75, 2);
  });

  it('reports a decrease as a negative change', () => {
    expect(priceChangeImpact({ oldMonthly: 250_000, newMonthly: 200_000, commitment: 5_000_000, ownPool: 0 }).monthlyDelta).toBe(-50_000);
  });
});

describe('priceChangeSince', () => {
  it('reports the change since the first price', () => {
    expect(priceChangeSince(history, '2026-07-01')).toEqual({ percent: 12, sinceMonth: '2026-01' });
  });

  it('is null when the price never changed or the new price is not in effect yet', () => {
    expect(priceChangeSince([history[0]!], '2026-07-01')).toBeNull();
    expect(priceChangeSince(history, '2026-03-01')).toBeNull();
    expect(priceChangeSince([], '2026-03-01')).toBeNull();
  });
});
