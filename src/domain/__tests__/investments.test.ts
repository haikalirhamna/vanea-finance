import {
  Holding, allocationOf, cashOf, concentratedClass, investmentTotals, isHighRisk, isStale, latestValuation, onPaper,
  planSale, putInOf, riskOf,
} from '../investments';
import { Transaction } from '../ledger-types';
import { tx } from './helpers/builders';

const contribute = (holdingId: string, amount: number, date = '2026-02-01'): Transaction =>
  tx('investment_contribution', amount, { holdingId, date });

describe('risk labels', () => {
  it.each([
    ['time_deposit', 'low'], ['government_bond', 'low'], ['money_market_fund', 'low'], ['fixed_income_fund', 'low_medium'],
    ['mixed_fund', 'medium'], ['gold', 'medium'], ['equity_fund', 'high'], ['stock', 'high'], ['crypto_digital', 'very_high'],
  ] as const)('%s is %s in general', (assetClass, risk) => {
    expect(riskOf({ assetClass })).toBe(risk);
  });

  it('takes the user\'s own label for "other"', () => {
    expect(riskOf({ assetClass: 'other' })).toBeNull();
    expect(riskOf({ assetClass: 'other', riskOverride: 'high' })).toBe('high');
  });

  it('flags high and very high', () => {
    expect([null, 'low', 'medium', 'high', 'very_high'].map((r) => isHighRisk(r as never))).toEqual([false, false, false, true, true]);
  });
});

describe('put in and cash', () => {
  it('is what was contributed minus the cost of what was sold', () => {
    const book = [
      contribute('bbca', 11_000_000), contribute('btc', 8_000_000),
      tx('investment_sale', 5_000_000, { holdingId: 'btc', costRemoved: 4_000_000, destinationAccount: 'personal', date: '2026-03-01' }),
    ];
    expect(putInOf(book, 'bbca')).toBe(11_000_000);
    expect(putInOf(book, 'btc')).toBe(4_000_000);
  });

  it('keeps cash income apart from put in', () => {
    const book = [contribute('bbca', 1_000_000), tx('investment_income', 80_000, { holdingId: 'bbca' })];
    expect(putInOf(book, 'bbca')).toBe(1_000_000);
    expect(cashOf(book, 'bbca')).toBe(80_000);
  });
});

describe('valuations', () => {
  const values = [{ value: 11_500_000, asOf: '2026-08-01' }, { value: 12_300_000, asOf: '2026-10-01' }, { value: 9_000_000, asOf: '2026-05-01' }];

  it('uses the latest estimate by date, not by order', () => {
    expect(latestValuation(values)).toEqual({ value: 12_300_000, asOf: '2026-10-01' });
    expect(latestValuation([])).toBeNull();
  });

  it('flags an estimate older than 90 days', () => {
    expect(isStale({ value: 1, asOf: '2026-07-11' }, '2026-10-09')).toBe(false); // exactly 90 days
    expect(isStale({ value: 1, asOf: '2026-07-10' }, '2026-10-09')).toBe(true); // 91 days
    expect(isStale({ value: 1, asOf: '2026-10-09' }, '2026-10-09')).toBe(false);
  });

  it('shows the difference on paper as a plain signed number', () => {
    expect(onPaper(12_300_000, 11_000_000)).toBe(1_300_000);
    expect(onPaper(500_000, 800_000)).toBe(-300_000);
  });
});

describe('planSale', () => {
  it('removes the whole cost when everything is sold', () => {
    expect(planSale({ putIn: 4_000_000, proceeds: 4_600_000, share: 'all' })).toEqual({ costRemoved: 4_000_000, realizedGain: 600_000 });
  });

  it('removes a proportional cost for a part', () => {
    expect(planSale({ putIn: 4_000_000, proceeds: 1_500_000, share: 0.25 })).toEqual({ costRemoved: 1_000_000, realizedGain: 500_000 });
  });

  it('reports a loss as negative', () => {
    expect(planSale({ putIn: 4_000_000, proceeds: 3_000_000, share: 'all' }).realizedGain).toBe(-1_000_000);
    expect(planSale({ putIn: 4_000_000, proceeds: 0, share: 'all' }).realizedGain).toBe(-4_000_000);
  });

  it('rounds the cost removed to a whole rupiah', () => {
    expect(planSale({ putIn: 1_000, proceeds: 0, share: 1 / 3 }).costRemoved).toBe(333);
  });
});

describe('allocation and concentration', () => {
  const stock: Holding = { id: 'bbca', assetClass: 'stock' };
  const crypto: Holding = { id: 'btc', assetClass: 'crypto_digital' };
  const fund: Holding = { id: 'rd', assetClass: 'money_market_fund' };

  it('groups put in by asset class, largest first, with shares and risk', () => {
    const result = allocationOf([
      { holding: stock, putIn: 11_000_000 }, { holding: crypto, putIn: 8_000_000 }, { holding: fund, putIn: 6_000_000 },
      { holding: { id: 'bbri', assetClass: 'stock' }, putIn: 0 },
    ]);
    expect(result.map((a) => [a.assetClass, a.putIn, Math.round(a.share * 100), a.risk])).toEqual([
      ['stock', 11_000_000, 44, 'high'], ['crypto_digital', 8_000_000, 32, 'very_high'], ['money_market_fund', 6_000_000, 24, 'low'],
    ]);
  });

  it('adds holdings of the same class together', () => {
    const result = allocationOf([{ holding: stock, putIn: 1_000 }, { holding: { id: 'bbri', assetClass: 'stock' }, putIn: 2_000 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ putIn: 3_000, share: 1 });
  });

  it('has no shares without money', () => {
    expect(allocationOf([{ holding: stock, putIn: 0 }])[0]!.share).toBe(0);
    expect(allocationOf([])).toEqual([]);
  });

  it('notes a high-risk class above half of what was put in', () => {
    const heavy = allocationOf([{ holding: crypto, putIn: 6_200_000 }, { holding: fund, putIn: 3_800_000 }]);
    expect(concentratedClass(heavy)).toMatchObject({ assetClass: 'crypto_digital' });
  });

  it('stays quiet at exactly half, for low-risk classes and for unlabeled ones', () => {
    expect(concentratedClass(allocationOf([{ holding: crypto, putIn: 5_000 }, { holding: fund, putIn: 5_000 }]))).toBeNull();
    expect(concentratedClass(allocationOf([{ holding: fund, putIn: 9_000 }, { holding: crypto, putIn: 1_000 }]))).toBeNull();
    expect(concentratedClass(allocationOf([{ holding: { id: 'x', assetClass: 'other' }, putIn: 9_000 }]))).toBeNull();
  });
});

describe('investmentTotals', () => {
  it('shows put in as the main total, with the estimate and the paper difference over holdings that have one', () => {
    const result = investmentTotals([
      { putIn: 11_000_000, valuations: [{ value: 12_300_000, asOf: '2026-10-01' }] },
      { putIn: 8_000_000, valuations: [{ value: 7_100_000, asOf: '2026-08-12' }, { value: 6_500_000, asOf: '2026-05-01' }] },
      { putIn: 6_000_000, valuations: [] },
    ]);
    expect(result).toEqual({
      putIn: 25_000_000, estimatedValue: 19_400_000, holdingsWithoutEstimate: 1, oldestEstimate: '2026-08-12', onPaper: 400_000,
    });
  });

  it('has no estimate without valuations', () => {
    expect(investmentTotals([{ putIn: 1_000, valuations: [] }])).toEqual({
      putIn: 1_000, estimatedValue: null, holdingsWithoutEstimate: 1, oldestEstimate: null, onPaper: null,
    });
    expect(investmentTotals([]).putIn).toBe(0);
  });
});
