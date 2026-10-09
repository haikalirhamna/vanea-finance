import { InstallmentLoan, totalToRepay } from '../installment-loans';
import {
  compareIntention, debtAndInvestmentLines, expenseTotals, findHighlights, salaryReceivedIn, setAsideIn, summarizeMonth,
} from '../reflection';
import { expense, salaryPayment, tx } from './helpers/builders';

const ONBOARDED = '2026-01-01';

/** One expense per category per month, so each month's total is easy to read. */
function spendingPattern(month: string, totals: { needs?: number; wants?: number; growth?: number; unexpected?: number }) {
  const entries = Object.entries(totals) as ['needs' | 'wants' | 'growth' | 'unexpected', number][];
  return entries.map(([category, amount]) => expense(amount, `${month}-10`, category));
}

describe('monthly totals', () => {
  const book = [
    expense(3_900_000, '2026-09-03', 'needs'),
    expense(1_600_000, '2026-09-15', 'wants'),
    expense(600_000, '2026-09-20', 'growth'),
    expense(600_000, '2026-09-28', 'unexpected'),
    expense(999, '2026-10-01', 'needs'),
  ];

  it('totals expenses by Kakeibo category within the month', () => {
    expect(expenseTotals(book, '2026-09')).toEqual({ needs: 3_900_000, wants: 1_600_000, growth: 600_000, unexpected: 600_000 });
  });

  it('leaves out reversed expenses', () => {
    const wrong = expense(500_000, '2026-09-05', 'wants');
    const undo = tx('reversal', 500_000, { date: '2026-09-06', reversesId: wrong.id });
    expect(expenseTotals([...book, wrong, undo], '2026-09').wants).toBe(1_600_000);
  });

  it('counts salary received in the month', () => {
    const paid = [salaryPayment(8_000_000, '2026-09', '2026-09-25'), salaryPayment(1, '2026-10', '2026-10-25')];
    expect(salaryReceivedIn(paid, '2026-09')).toBe(8_000_000);
  });

  it('nets savings and investment movements out of personal spending, ignoring Pool surplus', () => {
    const moves = [
      tx('savings_deposit', 700_000, { date: '2026-09-02' }),
      tx('investment_contribution', 300_000, { date: '2026-09-03' }),
      tx('savings_withdrawal', 100_000, { date: '2026-09-04' }),
      tx('surplus_allocation', 5_000_000, { date: '2026-09-05', account: 'savings' }),
      tx('savings_deposit', 999, { date: '2026-10-01' }),
    ];
    expect(setAsideIn(moves, '2026-09')).toBe(900_000);
  });

  it('takes money back out of what was set aside when an investment pays out to Available Spending', () => {
    const moves = [
      tx('investment_contribution', 1_000_000, { holdingId: 'h1', date: '2026-09-02' }),
      tx('investment_sale', 600_000, { holdingId: 'h1', costRemoved: 500_000, destinationAccount: 'personal', date: '2026-09-10' }),
      tx('investment_cash_withdrawal', 50_000, { holdingId: 'h1', destinationAccount: 'personal', date: '2026-09-11' }),
      tx('investment_sale', 900_000, { holdingId: 'h2', costRemoved: 800_000, destinationAccount: 'savings', date: '2026-09-12' }),
    ];
    expect(setAsideIn(moves, '2026-09')).toBe(1_000_000 - 600_000 - 50_000);
  });

  it('summarizes the month for the reflection screen', () => {
    const summary = summarizeMonth([...book, salaryPayment(8_000_000, '2026-09', '2026-09-25'), tx('savings_deposit', 900_000, { date: '2026-09-26' })], '2026-09');
    expect(summary).toMatchObject({ month: '2026-09', received: 8_000_000, totalSpent: 6_700_000, setAside: 900_000 });
  });
});

describe('findHighlights', () => {
  const steady = (month: string) => spendingPattern(month, { needs: 3_000_000, wants: 1_200_000, growth: 500_000, unexpected: 100_000 });
  const lead = [...steady('2026-05'), ...steady('2026-06'), ...steady('2026-07')];

  it('flags a category that moved by more than 20% and Rp 200.000', () => {
    const book = [...lead, ...spendingPattern('2026-08', { needs: 3_000_000, wants: 1_600_000, growth: 500_000, unexpected: 100_000 })];
    expect(findHighlights(book, '2026-08', ONBOARDED)).toEqual([
      { category: 'wants', current: 1_600_000, average: 1_200_000, delta: 400_000, isNewSpending: false },
    ]);
  });

  it('ignores moves that are large in percent but small in rupiah, or the reverse', () => {
    const smallRupiah = [...lead, ...spendingPattern('2026-08', { needs: 3_000_000, wants: 1_200_000, growth: 500_000, unexpected: 250_000 })];
    expect(findHighlights(smallRupiah, '2026-08', ONBOARDED)).toEqual([]);
    const smallPercent = [...lead, ...spendingPattern('2026-08', { needs: 3_300_000, wants: 1_200_000, growth: 500_000, unexpected: 100_000 })];
    expect(findHighlights(smallPercent, '2026-08', ONBOARDED)).toEqual([]);
  });

  it('also flags a notable drop', () => {
    const book = [...lead, ...spendingPattern('2026-08', { needs: 2_000_000, wants: 1_200_000, growth: 500_000, unexpected: 100_000 })];
    expect(findHighlights(book, '2026-08', ONBOARDED)[0]).toMatchObject({ category: 'needs', delta: -1_000_000 });
  });

  it('treats spending in a previously empty category as new', () => {
    const quiet = ['2026-05', '2026-06', '2026-07'].flatMap((m) => spendingPattern(m, { needs: 3_000_000 }));
    const book = [...quiet, ...spendingPattern('2026-08', { needs: 3_000_000, growth: 600_000 })];
    expect(findHighlights(book, '2026-08', ONBOARDED)).toEqual([
      { category: 'growth', current: 600_000, average: 0, delta: 600_000, isNewSpending: true },
    ]);
  });

  it('shows at most two, largest change first', () => {
    const book = [...lead, ...spendingPattern('2026-08', { needs: 4_500_000, wants: 2_000_000, growth: 1_000_000, unexpected: 100_000 })];
    expect(findHighlights(book, '2026-08', ONBOARDED).map((h) => h.category)).toEqual(['needs', 'wants']);
  });

  it('needs three full observed months after onboarding', () => {
    const book = [...lead, ...spendingPattern('2026-08', { needs: 9_000_000 })];
    expect(findHighlights(book, '2026-08', '2026-05-12')).toEqual([]);
    expect(findHighlights(book, '2026-08', '2026-04-30')).not.toEqual([]);
    expect(findHighlights(book, '2026-07', '2026-05-01')).toEqual([]); // April predates onboarding
  });
});

describe('compareIntention', () => {
  const summary = summarizeMonth(
    [expense(1_600_000, '2026-09-10', 'wants'), tx('savings_deposit', 900_000, { date: '2026-09-26' })], '2026-09');

  it('shows plain amounts, with no score', () => {
    expect(compareIntention({ setAsideAmount: 1_000_000, wantsLimit: 1_500_000 }, summary)).toEqual({
      setAsideIntended: 1_000_000, setAsideActual: 900_000, setAsideShortfall: 100_000,
      wantsSpent: 1_600_000, wantsLimit: 1_500_000, wantsOverLimit: true,
    });
  });

  it('has no shortfall when the intention was met, and no limit means never over', () => {
    const result = compareIntention({ setAsideAmount: 500_000, wantsLimit: null }, summary);
    expect(result).toMatchObject({ setAsideShortfall: 0, wantsOverLimit: false, wantsLimit: null });
  });
});

describe('debtAndInvestmentLines', () => {
  const kredivo: InstallmentLoan = {
    id: 'kredivo', purpose: 'personal', received: 3_000_000, installmentAmount: 550_000, installmentCount: 6,
    frequency: 'monthly', startDate: '2026-08-02', firstDueDate: '2026-09-02',
  };
  const biz: InstallmentLoan = { ...kredivo, id: 'biz', purpose: 'business' };
  const loanPay = (id: string, source: 'personal' | 'pool') =>
    tx('debt_payment', 550_000, { debtId: id, paymentMethod: 'installment', sourceAccount: source, date: '2026-09-02' });
  const book = [
    tx('loan_start', 3_000_000, { debtId: 'kredivo', paymentMethod: 'installment', totalOwed: totalToRepay(kredivo), destinationAccount: 'personal', date: '2026-08-02' }),
    loanPay('kredivo', 'personal'),
    loanPay('biz', 'pool'),
    tx('debt_payment', 1_200_000, { debtId: 'paylater', paymentMethod: 'credit_line', sourceAccount: 'personal', reservePart: 1_200_000, date: '2026-09-25' }),
    tx('debt_cost', 45_000, { debtId: 'paylater', paymentMethod: 'credit_line', debtCostType: 'fee', date: '2026-09-26' }),
    tx('debt_cost', 20_000, { debtId: 'kredivo', paymentMethod: 'installment', debtCostType: 'late_fee', date: '2026-09-27' }),
    tx('debt_cost', 99_000, { debtId: 'biz', paymentMethod: 'installment', debtCostType: 'late_fee', date: '2026-09-27' }),
    tx('investment_income', 80_000, { holdingId: 'h1', date: '2026-09-15' }),
    tx('investment_sale', 4_600_000, { holdingId: 'h1', costRemoved: 4_000_000, destinationAccount: 'personal', date: '2026-09-20' }),
    tx('investment_sale', 1_000_000, { holdingId: 'h2', costRemoved: 1_300_000, destinationAccount: 'savings', date: '2026-09-21' }),
  ];

  it('totals personal debt payments, apart from Kakeibo spending', () => {
    expect(debtAndInvestmentLines(book, '2026-09', [kredivo, biz]).debtPayments).toBe(550_000 + 1_200_000);
  });

  it('counts personal interest, fees and late fees as the cost of borrowing — not business ones', () => {
    // 50.000 interest in the installment + 45.000 card fee + 20.000 personal late fee.
    expect(debtAndInvestmentLines(book, '2026-09', [kredivo, biz]).costOfBorrowing).toBe(50_000 + 45_000 + 20_000);
  });

  it('adds investment income and realized gains or losses', () => {
    const lines = debtAndInvestmentLines(book, '2026-09', [kredivo, biz]);
    expect(lines.investmentIncome).toBe(80_000);
    expect(lines.realizedGains).toBe(600_000 - 300_000);
  });

  it('is zero in a month without any of it', () => {
    expect(debtAndInvestmentLines(book, '2026-07', [kredivo, biz])).toEqual({
      debtPayments: 0, costOfBorrowing: 0, investmentIncome: 0, realizedGains: 0,
    });
  });
});
