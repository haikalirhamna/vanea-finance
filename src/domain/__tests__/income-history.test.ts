import { amountsOf, netIncomeSeries } from '../income-history';
import { InstallmentLoan, totalToRepay } from '../installment-loans';
import { businessCost, income, reversalOf, subscriptionCost, tx } from './helpers/builders';

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

  describe('yearly subscriptions', () => {
    it('spreads a yearly charge over 12 months starting with the month paid (PRD example)', () => {
      const result = netIncomeSeries([income(5_000_000, '2025-10-10'), subscriptionCost(2_400_000, '2025-10-15', 'yearly')], [], '2026-02-10');
      expect(result.map((m) => m.amount)).toEqual([4_800_000, -200_000, -200_000, -200_000]);
      expect(result.map((m) => m.month)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01']);
    });

    it('counts a monthly subscription in full in the month paid', () => {
      const result = netIncomeSeries([income(1_000_000, '2026-01-10'), subscriptionCost(225_000, '2026-01-15', 'monthly')], [], TODAY);
      expect(result[0]).toEqual({ month: '2026-01', amount: 775_000 });
    });

    it('does not spread other costs, even with a yearly-looking amount', () => {
      const result = netIncomeSeries([income(5_000_000, '2026-01-10'), tx('business_cost', 2_400_000, { date: '2026-01-15', businessCostCategory: 'tools', billingCycle: 'yearly' })], [], TODAY);
      expect(result[0]!.amount).toBe(2_600_000);
    });

    it('removes every share when the charge is reversed', () => {
      const cost = subscriptionCost(2_400_000, '2026-01-15', 'yearly');
      const reversed = netIncomeSeries([income(1_000_000, '2026-01-10'), cost, reversalOf(cost, '2026-01-20')], [], TODAY);
      expect(reversed.map((m) => m.amount)).toEqual([1_000_000, 0, 0, 0, 0]);
    });

    it('counts only the shares of completed months', () => {
      const result = netIncomeSeries([subscriptionCost(2_400_000, '2026-05-15', 'yearly')], [], TODAY);
      expect(result.map((m) => m.month)).toEqual(['2026-05']);
    });
  });

  describe('money that is never income', () => {
    it('ignores loan money received, investment income and sale proceeds, opening balances and transfers', () => {
      const other = [
        tx('loan_start', 3_000_000, { debtId: 'd1', totalOwed: 3_300_000, destinationAccount: 'personal', date: '2026-02-01' }),
        tx('investment_income', 80_000, { holdingId: 'h1', date: '2026-02-02' }),
        tx('investment_sale', 5_000_000, { holdingId: 'h1', costRemoved: 4_000_000, destinationAccount: 'personal', date: '2026-02-03' }),
        tx('opening_balance', 9_000_000, { account: 'pool', date: '2026-02-04' }),
        tx('savings_deposit', 100_000, { date: '2026-02-05' }),
        income(1_000_000, '2026-02-10'),
      ];
      expect(netIncomeSeries(other, [], TODAY)[0]).toEqual({ month: '2026-02', amount: 1_000_000 });
    });
  });

  describe('business loans', () => {
    const business: InstallmentLoan = {
      id: 'biz', purpose: 'business', received: 3_000_000, installmentAmount: 550_000, installmentCount: 6,
      frequency: 'monthly', startDate: '2026-01-02', firstDueDate: '2026-02-02',
    };
    const loanTx = [
      tx('loan_start', 3_000_000, { debtId: 'biz', paymentMethod: 'installment', totalOwed: totalToRepay(business), destinationAccount: 'pool', date: '2026-01-02' }),
      tx('debt_payment', 550_000, { debtId: 'biz', paymentMethod: 'installment', sourceAccount: 'pool', date: '2026-02-02' }),
    ];

    it('counts only the interest of each payment as a cost; the loan money and principal are not income or cost', () => {
      const result = netIncomeSeries([income(5_000_000, '2026-01-10'), ...loanTx], [], TODAY, [business]);
      expect(result.slice(0, 2)).toEqual([{ month: '2026-01', amount: 5_000_000 }, { month: '2026-02', amount: -50_000 }]);
    });

    it('does not count a personal loan\'s interest against work income', () => {
      const personal = { ...business, purpose: 'personal' as const };
      const result = netIncomeSeries([income(5_000_000, '2026-01-10'), ...loanTx], [], TODAY, [personal]);
      expect(result[1]).toEqual({ month: '2026-02', amount: 0 });
    });
  });
});
