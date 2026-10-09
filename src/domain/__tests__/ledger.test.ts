import {
  Account, Transaction, activeTransactions, allMovements, balanceBefore, balanceOf, balanceThrough,
  createReversal, findShortfall, maxDebitAllowed, planIncomeReversal, scopedBalance,
} from '../ledger';
import { expense, income, opening, reversalOf, salaryPayment, tx } from './helpers/builders';

const balances = (transactions: Transaction[]): Record<'pool' | 'personal' | 'savings', number> => {
  const movements = allMovements(transactions);
  const of = (account: Account) => balanceOf(movements, account);
  return { pool: of('pool'), personal: of('personal'), savings: of('savings') };
};

describe('balances', () => {
  const book = [
    opening('pool', 1_000, '2026-01-01'),
    income(500, '2026-02-10'),
    salaryPayment(700, '2026-02', '2026-02-25'),
    expense(200, '2026-03-01'),
  ];

  it('sums movements by account', () => {
    expect(balances(book)).toEqual({ pool: 800, personal: 500, savings: 0 });
  });

  it('reads balances as of a date', () => {
    const movements = allMovements(book);
    expect(balanceThrough(movements, 'pool', '2026-02-10')).toBe(1_500);
    expect(balanceBefore(movements, 'pool', '2026-02-10')).toBe(1_000);
    expect(balanceThrough(movements, 'personal', '2026-02-24')).toBe(0);
  });

  it('keeps scoped accounts apart by reference id', () => {
    const holdings = [
      tx('investment_contribution', 300, { holdingId: 'h1' }),
      tx('investment_contribution', 200, { holdingId: 'h2' }),
    ];
    const movements = allMovements(holdings);
    expect(balanceOf(movements, 'investment', 'h1')).toBe(300);
    expect(balanceOf(movements, 'investment', 'h2')).toBe(200);
    expect(balanceOf(movements, 'investment')).toBe(500);
    expect(scopedBalance(holdings, 'investment', 'h2')).toBe(200);
    expect(balanceThrough(movements, 'investment', '2026-01-14', 'h1')).toBe(0);
    expect(balanceBefore(movements, 'investment', '2026-01-16', 'h1')).toBe(300);
  });
});

describe('findShortfall', () => {
  it('finds nothing in a healthy book', () => {
    expect(findShortfall(allMovements([income(1_000, '2026-03-01'), expense(5_000, '2026-03-02')]))).toBeNull();
  });

  it('lets personal go negative but not other accounts', () => {
    expect(findShortfall(allMovements([expense(50_000, '2026-02-01')]))).toBeNull();
    expect(findShortfall(allMovements([tx('savings_withdrawal', 10)]))).toEqual({
      account: 'savings', date: '2026-01-15', shortfall: 10,
    });
  });

  it('names the holding, line or debt that goes negative', () => {
    const sale = tx('investment_sale', 100, { holdingId: 'h1', costRemoved: 40, destinationAccount: 'personal' });
    expect(findShortfall(allMovements([sale]))).toMatchObject({ account: 'investment', refId: 'h1', shortfall: 40 });
  });

  it('judges by end of day: income and spending on the same day is fine', () => {
    const book = [salaryPayment(900, '2026-03', '2026-03-10'), income(1_000, '2026-03-10')];
    expect(findShortfall(allMovements(book))).toBeNull();
  });
});

describe('maxDebitAllowed', () => {
  const book = [income(1_000, '2026-03-01'), salaryPayment(700, '2026-03', '2026-03-20')];

  it('is limited by the lowest balance from the date onwards', () => {
    expect(maxDebitAllowed(book, 'pool', '2026-03-05')).toBe(300);
    expect(maxDebitAllowed(book, 'pool', '2026-03-25')).toBe(300);
    expect(maxDebitAllowed(book, 'pool', '2026-02-01')).toBe(0);
  });

  it('works per holding', () => {
    const holdings = [tx('investment_contribution', 300, { holdingId: 'h1' }), tx('investment_contribution', 900, { holdingId: 'h2' })];
    expect(maxDebitAllowed(holdings, 'investment', '2026-02-01', 'h1')).toBe(300);
  });
});

describe('active transactions and reversal helpers', () => {
  const original = expense(300, '2026-02-01');

  it('cancels the original out of active transactions', () => {
    const reversal = reversalOf(original, '2026-02-02');
    expect(activeTransactions([original, reversal]).map((t) => t.id)).toEqual([]);
    expect(balances([original, reversal]).personal).toBe(0);
  });

  it('builds a reversal from an original', () => {
    expect(createReversal(original, { id: 'r1', date: '2026-02-02' })).toEqual({
      id: 'r1', kind: 'reversal', date: '2026-02-02', amount: 300, reversesId: original.id,
    });
  });
});

describe('planIncomeReversal', () => {
  it('returns everything to the Pool when it can absorb the income', () => {
    const received = income(1_000, '2026-02-01');
    expect(planIncomeReversal([received], received.id, '2026-02-02')).toEqual({ poolPart: 1_000, remainder: 0 });
  });

  it('splits off the part already paid out as salary', () => {
    const received = income(1_000, '2026-02-01');
    const paid = salaryPayment(800, '2026-02', '2026-02-10');
    expect(planIncomeReversal([received, paid], received.id, '2026-02-20')).toEqual({ poolPart: 200, remainder: 800 });
  });

  it('turns the whole income into a remainder when the Pool is empty', () => {
    const received = income(1_000, '2026-02-01');
    const paid = salaryPayment(1_000, '2026-02', '2026-02-10');
    expect(planIncomeReversal([received, paid], received.id, '2026-02-20')).toEqual({ poolPart: 0, remainder: 1_000 });
  });

  it('refuses anything that is not an unreversed income', () => {
    const received = income(1_000, '2026-02-01');
    expect(() => planIncomeReversal([received], 'missing', '2026-02-02')).toThrow();
    expect(() => planIncomeReversal([expense(5, '2026-02-01')], 't-none', '2026-02-02')).toThrow();
    const reversed = [received, reversalOf(received, '2026-02-02')];
    expect(() => planIncomeReversal(reversed, received.id, '2026-02-03')).toThrow(/already reversed/);
  });
});
