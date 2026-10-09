import { amountsOf, netIncomeSeries } from '../income-history';
import { businessCost, income, reversalOf } from './helpers/builders';

const TODAY = '2026-06-10';

describe('netIncomeSeries', () => {
  it('is empty without any data', () => {
    expect(netIncomeSeries([], [], TODAY)).toEqual([]);
  });

  it('sums income per month, subtracts business costs and fills gaps with zero', () => {
    const transactions = [
      income(5_000_000, '2026-01-10'),
      income(1_000_000, '2026-01-20'),
      businessCost(225_000, '2026-01-25'),
      income(3_000_000, '2026-04-02'),
    ];
    const result = netIncomeSeries(transactions, [], TODAY);
    expect(result).toEqual([
      { month: '2026-01', amount: 5_775_000 },
      { month: '2026-02', amount: 0 },
      { month: '2026-03', amount: 0 },
      { month: '2026-04', amount: 3_000_000 },
      { month: '2026-05', amount: 0 },
    ]);
  });

  it('excludes the current, incomplete month', () => {
    const result = netIncomeSeries([income(9, '2026-05-30'), income(9, '2026-06-02')], [], TODAY);
    expect(result.map((m) => m.month)).toEqual(['2026-05']);
  });

  it('starts from the earliest historical month and adds records in the same month', () => {
    const historical = [{ month: '2025-12', amount: 4_000_000 }, { month: '2026-01', amount: 1_000_000 }];
    const result = netIncomeSeries([income(500_000, '2026-01-15')], historical, TODAY);
    expect(result[0]).toEqual({ month: '2025-12', amount: 4_000_000 });
    expect(result[1]).toEqual({ month: '2026-01', amount: 1_500_000 });
    expect(result).toHaveLength(6);
  });

  it('drops reversed income entirely, together with its reversal', () => {
    const wrong = income(8_000_000, '2026-02-10');
    const real = income(2_000_000, '2026-02-12');
    const result = netIncomeSeries([wrong, real, reversalOf(wrong, '2026-03-01')], [], TODAY);
    expect(result.find((m) => m.month === '2026-02')?.amount).toBe(2_000_000);
  });

  it('can be negative in a month of heavy costs', () => {
    const result = netIncomeSeries([businessCost(2_000_000, '2026-03-05')], [], TODAY);
    expect(result[0]).toEqual({ month: '2026-03', amount: -2_000_000 });
  });

  it('extracts amounts', () => {
    expect(amountsOf([{ month: '2026-01', amount: 7 }])).toEqual([7]);
  });
});
