import {
  Account, Transaction, TransactionKind, activeTransactions, allMovements, balanceBefore, balanceOf,
  balanceThrough, createReversal, maxDebitAllowed, movementsOf, planIncomeReversal, validateTransactions,
} from '../ledger';
import { RULES, businessCost, expense, income, opening, reversalOf, salaryPayment, tx } from './helpers/builders';

const balances = (transactions: Transaction[]): Record<Account, number> => {
  const movements = allMovements(transactions);
  return {
    pool: balanceOf(movements, 'pool'),
    personal: balanceOf(movements, 'personal'),
    savings: balanceOf(movements, 'savings'),
    investment: balanceOf(movements, 'investment'),
  };
};

describe('movements per transaction kind', () => {
  const cases: [TransactionKind, Partial<Transaction>, Partial<Record<Account, number>>][] = [
    ['opening_balance', { account: 'savings' }, { savings: 100 }],
    ['income', {}, { pool: 100 }],
    ['business_cost', {}, { pool: -100 }],
    ['salary_payment', {}, { pool: -100, personal: 100 }],
    ['expense', {}, { personal: -100 }],
    ['savings_deposit', {}, { personal: -100, savings: 100 }],
    ['savings_withdrawal', {}, { savings: -100, personal: 100 }],
    ['investment_contribution', {}, { personal: -100, investment: 100 }],
    ['investment_withdrawal', {}, { investment: -100, personal: 100 }],
    ['surplus_allocation', { account: 'investment' }, { pool: -100, investment: 100 }],
    ['advance_disbursement', {}, { pool: -100, personal: 100 }],
    ['advance_early_repayment', {}, { personal: -100, pool: 100 }],
  ];

  it.each(cases)('%s', (kind, extra, expected) => {
    const result: Partial<Record<Account, number>> = {};
    for (const m of movementsOf(tx(kind, 100, extra))) result[m.account] = m.amount;
    expect(result).toEqual(expected);
  });

  it('omits zero-amount movements', () => {
    expect(movementsOf(salaryPayment(0, '2026-10', '2026-10-25', 500_000))).toEqual([]);
  });

  it('negates the original for a full reversal', () => {
    const original = tx('savings_deposit', 100);
    const result = movementsOf(reversalOf(original, '2026-02-01'), original);
    expect(result.map((m) => [m.account, m.amount])).toEqual([['personal', 100], ['savings', -100]]);
  });

  it('removes only the given pool part for an income reversal', () => {
    const original = income(100);
    const result = movementsOf(reversalOf(original, '2026-02-01', 30), original);
    expect(result.map((m) => [m.account, m.amount])).toEqual([['pool', -30]]);
  });

  it('refuses a reversal without its original', () => {
    expect(() => movementsOf(reversalOf(income(100), '2026-02-01'))).toThrow();
  });
});

describe('balances', () => {
  const book = [
    opening('pool', 1_000, '2026-01-01'),
    income(500, '2026-02-10'),
    salaryPayment(700, '2026-02', '2026-02-25'),
    expense(200, '2026-03-01'),
  ];

  it('sums movements by account', () => {
    expect(balances(book)).toEqual({ pool: 800, personal: 500, savings: 0, investment: 0 });
  });

  it('reads balances as of a date', () => {
    const movements = allMovements(book);
    expect(balanceThrough(movements, 'pool', '2026-02-10')).toBe(1_500);
    expect(balanceBefore(movements, 'pool', '2026-02-10')).toBe(1_000);
    expect(balanceThrough(movements, 'personal', '2026-02-24')).toBe(0);
  });
});

describe('Pool invariant', () => {
  it('rejects a salary payment larger than the Pool, reporting the shortfall', () => {
    const existing = [opening('pool', 3_500_000)];
    const result = validateTransactions(existing, [salaryPayment(5_000_000, '2026-10', '2026-10-09')], RULES);
    expect(result).toEqual({
      ok: false, code: 'INSUFFICIENT_BALANCE', account: 'pool', date: '2026-10-09', shortfall: 1_500_000,
    });
  });

  it('allows spending income received the same day', () => {
    const result = validateTransactions(
      [], [income(1_000, '2026-03-01'), salaryPayment(1_000, '2026-03', '2026-03-01')], { ...RULES, today: '2026-03-01' });
    expect(result).toEqual({ ok: true });
  });

  it('rejects a backdated payment that would leave a later day negative', () => {
    const existing = [income(1_000, '2026-03-01'), salaryPayment(900, '2026-03', '2026-03-20')];
    const result = validateTransactions(existing, [businessCost(500, '2026-03-10')], RULES);
    expect(result).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE', date: '2026-03-20', shortfall: 400 });
  });

  it('protects savings and investments but lets personal spending go negative', () => {
    expect(validateTransactions([], [tx('savings_withdrawal', 10)], RULES)).toMatchObject({
      ok: false, code: 'INSUFFICIENT_BALANCE', account: 'savings',
    });
    expect(validateTransactions([], [expense(50_000, '2026-02-01')], RULES)).toEqual({ ok: true });
  });

  it('reports the most that can be taken out, looking at later days too', () => {
    const existing = [income(1_000, '2026-03-01'), salaryPayment(700, '2026-03', '2026-03-20')];
    expect(maxDebitAllowed(existing, 'pool', '2026-03-05')).toBe(300);
    expect(maxDebitAllowed(existing, 'pool', '2026-03-25')).toBe(300);
    expect(maxDebitAllowed(existing, 'pool', '2026-02-01')).toBe(0);
  });
});

describe('structural validation', () => {
  const check = (t: Transaction, existing: Transaction[] = []) => validateTransactions(existing, [t], RULES);

  it('requires a positive whole amount', () => {
    expect(check(income(0))).toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(check(income(10.5))).toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(check(income(-5))).toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('allows a zero salary payment only when it records an advance installment', () => {
    const base = [opening('pool', 1_000)];
    expect(check(salaryPayment(0, '2026-10', '2026-10-09', 0), base)).toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(check(salaryPayment(0, '2026-10', '2026-10-09', 500), base)).toEqual({ ok: true });
  });

  it('rejects future dates, dates before onboarding and malformed dates', () => {
    expect(check(income(1, '2026-10-10'))).toMatchObject({ code: 'DATE_IN_FUTURE' });
    expect(check(income(1, '2025-12-31'))).toMatchObject({ code: 'DATE_BEFORE_ONBOARDING' });
    expect(check(income(1, '2026-02-30'))).toMatchObject({ code: 'INVALID_DATE' });
  });

  it('requires kind-specific fields', () => {
    expect(check(tx('expense', 10))).toMatchObject({ code: 'MISSING_FIELD' });
    expect(check(tx('business_cost', 10))).toMatchObject({ code: 'MISSING_FIELD' });
    expect(check(tx('opening_balance', 10))).toMatchObject({ code: 'MISSING_FIELD' });
    expect(check(tx('surplus_allocation', 10, { account: 'personal' }))).toMatchObject({ code: 'MISSING_FIELD' });
    expect(check(tx('salary_payment', 10))).toMatchObject({ code: 'MISSING_FIELD' });
    expect(check(tx('advance_disbursement', 10))).toMatchObject({ code: 'MISSING_FIELD' });
    expect(check(tx('advance_early_repayment', 10))).toMatchObject({ code: 'MISSING_FIELD' });
    expect(check(tx('reversal', 10))).toMatchObject({ code: 'MISSING_FIELD' });
  });
});

describe('reversals', () => {
  const rules = RULES;
  const original = expense(300, '2026-02-01');

  it('reverses a transaction exactly once', () => {
    const first = reversalOf(original, '2026-02-02');
    expect(validateTransactions([original], [first], rules)).toEqual({ ok: true });
    const second = reversalOf(original, '2026-02-03');
    expect(validateTransactions([original, first], [second], rules)).toMatchObject({ code: 'ALREADY_REVERSED' });
  });

  it('never reverses a reversal', () => {
    const reversal = reversalOf(original, '2026-02-02');
    const again = reversalOf(reversal, '2026-02-03');
    expect(validateTransactions([original, reversal], [again], rules)).toMatchObject({ code: 'NOT_REVERSIBLE' });
  });

  it('needs an existing original, a matching amount and a sensible date', () => {
    expect(validateTransactions([], [reversalOf(original, '2026-02-02')], rules)).toMatchObject({ code: 'ORIGINAL_NOT_FOUND' });
    expect(validateTransactions([original], [reversalOf(original, '2026-02-02', 100)], rules)).toMatchObject({ code: 'REVERSAL_AMOUNT_MISMATCH' });
    expect(validateTransactions([original], [reversalOf(original, '2026-01-20')], rules)).toMatchObject({ code: 'INVALID_DATE' });
  });

  it('lets only an income reversal be partial', () => {
    const received = income(1_000, '2026-02-01');
    expect(validateTransactions([received], [reversalOf(received, '2026-02-02', 400)], rules)).toEqual({ ok: true });
    expect(validateTransactions([received], [reversalOf(received, '2026-02-02', 1_001)], rules)).toMatchObject({ code: 'REVERSAL_AMOUNT_MISMATCH' });
  });

  it('cancels the original out of active transactions', () => {
    const reversal = reversalOf(original, '2026-02-02');
    expect(activeTransactions([original, reversal]).map((t) => t.id)).toEqual([]);
    expect(balances([original, reversal]).personal).toBe(0);
  });

  it('rejects a reversal that would make the Pool negative', () => {
    const received = income(1_000, '2026-02-01');
    const paid = salaryPayment(800, '2026-02', '2026-02-10');
    expect(validateTransactions([received, paid], [reversalOf(received, '2026-02-20')], rules))
      .toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE', account: 'pool', shortfall: 800 });
  });

  it('judges a correction by its final state (reversal + replacement as one batch)', () => {
    const received = income(1_000, '2026-02-01');
    const paid = salaryPayment(800, '2026-02', '2026-02-10');
    const existing = [received, paid];
    const reversal = reversalOf(received, '2026-02-20');
    const replacement = income(1_500, '2026-02-01');
    expect(validateTransactions(existing, [reversal], rules)).toMatchObject({ ok: false });
    expect(validateTransactions(existing, [reversal, replacement], rules)).toEqual({ ok: true });
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
