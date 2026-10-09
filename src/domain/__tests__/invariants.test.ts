/**
 * Property tests for the invariants in SYSTEM-OVERVIEW §12.
 * Random operations are applied only when validation accepts them.
 */
import fc from 'fast-check';
import { addMonths } from '../calendar';
import { amountsOf } from '../income-history';
import {
  ACCOUNTS, Transaction, activeTransactions, allMovements, balanceOf, maxDebitAllowed, validateTransactions,
} from '../ledger';
import { depletionMonth, recommendSalary, sustainableSalary } from '../salary-recommendation';
import { evaluateRaise } from '../salary-review';
import { RULES, series } from './helpers/builders';

const DAYS = ['2026-02-03', '2026-03-10', '2026-04-15', '2026-05-20', '2026-06-25', '2026-07-30', '2026-08-31', '2026-09-30'];

type Operation =
  | { op: 'income' | 'businessCost' | 'salary' | 'expense' | 'save' | 'unsave' | 'invest' | 'allocate'; amount: number; day: number }
  | { op: 'reverse'; pick: number; day: number };

const operation = fc.oneof(
  fc.record({
    op: fc.constantFrom('income', 'businessCost', 'salary', 'expense', 'save', 'unsave', 'invest', 'allocate'),
    amount: fc.integer({ min: 1, max: 5_000_000 }),
    day: fc.integer({ min: 0, max: DAYS.length - 1 }),
  }),
  fc.record({ op: fc.constant('reverse' as const), pick: fc.nat(), day: fc.integer({ min: 0, max: DAYS.length - 1 }) }),
) as fc.Arbitrary<Operation>;

function build(operationInput: Operation, id: string, existing: Transaction[]): Transaction | null {
  const date = DAYS[operationInput.day]!;
  if (operationInput.op === 'reverse') {
    const candidates = existing.filter((t) => t.kind !== 'reversal');
    const original = candidates[operationInput.pick % Math.max(1, candidates.length)];
    if (!original) return null;
    return { id, kind: 'reversal', date: date > original.date ? date : original.date, amount: original.amount, reversesId: original.id };
  }
  const { amount } = operationInput;
  switch (operationInput.op) {
    case 'income': return { id, kind: 'income', date, amount };
    case 'businessCost': return { id, kind: 'business_cost', date, amount, businessCostCategory: 'tools' };
    case 'salary': return { id, kind: 'salary_payment', date, amount, salaryPeriod: date.slice(0, 7), advanceInstallment: 0 };
    case 'expense': return { id, kind: 'expense', date, amount, expenseCategory: 'wants' };
    case 'save': return { id, kind: 'savings_deposit', date, amount };
    case 'unsave': return { id, kind: 'savings_withdrawal', date, amount };
    case 'invest': return { id, kind: 'investment_contribution', date, amount };
    case 'allocate': return { id, kind: 'surplus_allocation', date, amount, account: 'savings' };
  }
}

function applyAll(operations: Operation[]): Transaction[] {
  const book: Transaction[] = [];
  operations.forEach((o, index) => {
    const candidate = build(o, `x${index}`, book);
    if (candidate && validateTransactions(book, [candidate], RULES).ok) book.push(candidate);
  });
  return book;
}

describe('ledger invariants', () => {
  it('never lets the Pool, savings or investments end any day negative', () => {
    fc.assert(
      fc.property(fc.array(operation, { maxLength: 40 }), (operations) => {
        const book = applyAll(operations);
        for (const date of DAYS) {
          const movements = allMovements(book).filter((m) => m.date <= date);
          for (const account of ['pool', 'savings', 'investment'] as const) {
            expect(balanceOf(movements, account)).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('reverses each transaction at most once and never reverses a reversal', () => {
    fc.assert(
      fc.property(fc.array(operation, { maxLength: 40 }), (operations) => {
        const book = applyAll(operations);
        const targets = book.filter((t) => t.kind === 'reversal').map((t) => t.reversesId);
        expect(new Set(targets).size).toBe(targets.length);
        for (const reversal of book.filter((t) => t.kind === 'reversal')) {
          expect(book.find((t) => t.id === reversal.reversesId)?.kind).not.toBe('reversal');
        }
      }),
      { numRuns: 300 },
    );
  });

  it('keeps the sum of all accounts equal to income minus business costs and expenses', () => {
    fc.assert(
      fc.property(fc.array(operation, { maxLength: 40 }), (operations) => {
        const active = activeTransactions(applyAll(operations));
        const total = (kind: Transaction['kind']) => active.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
        const movements = allMovements(applyAll(operations));
        const everything = ACCOUNTS.reduce((s, account) => s + balanceOf(movements, account), 0);
        expect(everything).toBe(total('income') - total('business_cost') - total('expense'));
      }),
      { numRuns: 300 },
    );
  });

  it('never allows a debit larger than maxDebitAllowed to pass validation', () => {
    fc.assert(
      fc.property(fc.array(operation, { maxLength: 25 }), fc.integer({ min: 0, max: DAYS.length - 1 }), (operations, day) => {
        const book = applyAll(operations);
        const date = DAYS[day]!;
        const limit = maxDebitAllowed(book, 'pool', date);
        const costOf = (amount: number): Transaction => ({ id: 'probe', kind: 'business_cost', date, amount, businessCostCategory: 'tools' });
        if (limit > 0) expect(validateTransactions(book, [costOf(limit)], RULES).ok).toBe(true);
        expect(validateTransactions(book, [costOf(limit + 1)], RULES).ok).toBe(false);
      }),
      { numRuns: 300 },
    );
  });
});

const incomeHistory = fc.array(fc.integer({ min: 0, max: 30_000_000 }), { minLength: 3, maxLength: 30 });
const poolAmount = fc.integer({ min: 0, max: 100_000_000 });

describe('salary recommendation invariants', () => {
  it('never exceeds 95% of average income and is a multiple of Rp 50.000', () => {
    fc.assert(
      fc.property(incomeHistory, poolAmount, (amounts, pool) => {
        const window = amounts.slice(-12);
        const mean = window.reduce((s, v) => s + v, 0) / window.length;
        const { amount } = recommendSalary(amounts, pool)!;
        expect(amount).toBeLessThanOrEqual(0.95 * mean + 1e-6);
        expect(amount % 50_000).toBe(0);
        expect(amount).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it('survives the weakest months repeating: the Pool can always pay the recommended salary', () => {
    fc.assert(
      fc.property(incomeHistory, poolAmount, (amounts, pool) => {
        const { amount } = recommendSalary(amounts, pool)!;
        expect(depletionMonth(amounts, pool, amount)).toBeNull();
      }),
      { numRuns: 500 },
    );
  });

  it('grows (never shrinks) as the Pool grows', () => {
    fc.assert(
      fc.property(incomeHistory, poolAmount, fc.integer({ min: 0, max: 50_000_000 }), (amounts, pool, extra) => {
        expect(sustainableSalary(amounts, pool + extra)).toBeGreaterThanOrEqual(sustainableSalary(amounts, pool));
      }),
      { numRuns: 300 },
    );
  });
});

describe('raise review invariants', () => {
  const reviewInput = fc.record({
    amounts: fc.array(fc.integer({ min: 0, max: 30_000_000 }), { minLength: 1, maxLength: 36 }),
    salary: fc.integer({ min: 100, max: 1_000 }).map((n) => n * 10_000),
    pool: poolAmount,
    anchor: fc.integer({ min: -3, max: 40 }),
  });

  it('only offers a raise when eligible, and never more than 5%', () => {
    fc.assert(
      fc.property(reviewInput, ({ amounts, salary, pool, anchor }) => {
        const months = series('2023-01', amounts);
        const result = evaluateRaise({ series: months, currentSalary: salary, pool, anchorPeriod: addMonths('2023-01', anchor) });
        if (result.status !== 'ELIGIBLE') {
          expect(result.maxNewSalary).toBeUndefined();
          return;
        }
        expect(result.maxNewSalary!).toBeGreaterThan(salary);
        expect(result.maxNewSalary!).toBeLessThanOrEqual(salary * 1.05);
        expect(result.maxNewSalary! % 10_000).toBe(0);
      }),
      { numRuns: 1_000 },
    );
  });

  it('only ever offers a salary the Pool could sustain through the weakest months', () => {
    fc.assert(
      fc.property(reviewInput, ({ amounts, salary, pool, anchor }) => {
        const months = series('2023-01', amounts);
        const result = evaluateRaise({ series: months, currentSalary: salary, pool, anchorPeriod: addMonths('2023-01', anchor) });
        if (result.status === 'ELIGIBLE') {
          expect(result.maxNewSalary!).toBeLessThanOrEqual(sustainableSalary(amountsOf(months), pool) + 1e-6);
          expect(depletionMonth(amountsOf(months), pool, result.maxNewSalary!)).toBeNull();
        }
      }),
      { numRuns: 1_000 },
    );
  });

  it('is never eligible without six months of data or inside the cooldown', () => {
    fc.assert(
      fc.property(reviewInput, ({ amounts, salary, pool }) => {
        const months = series('2023-01', amounts);
        const last = months[months.length - 1]!.month;
        const justChanged = evaluateRaise({ series: months, currentSalary: salary, pool, anchorPeriod: last });
        expect(justChanged.status).not.toBe('ELIGIBLE');
        if (months.length < 6) {
          const short = evaluateRaise({ series: months, currentSalary: salary, pool, anchorPeriod: '2000-01' });
          expect(short.status).toBe('INSUFFICIENT_DATA');
        }
      }),
      { numRuns: 500 },
    );
  });
});
