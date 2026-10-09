/**
 * Property tests for the invariants in SYSTEM-OVERVIEW §12.
 * Random operations are applied only when validation accepts them.
 */
import fc from 'fast-check';
import { addMonths } from '../calendar';
import { amountsOf, netIncomeSeries } from '../income-history';
import { InstallmentLoan, businessPrincipalOwed, owedOn, principalOwed, totalPaidOn, totalToRepay } from '../installment-loans';
import {
  Transaction, activeTransactions, allMovements, balanceOf, findShortfall, maxDebitAllowed,
} from '../ledger';
import { validateTransactions } from '../ledger-validation';
import { ownPool } from '../pool';
import { depletionMonth, recommendSalary, sustainableSalary } from '../salary-recommendation';
import { evaluateRaise } from '../salary-review';
import { spreadCharge } from '../subscriptions';
import { sum } from '../money';
import { RULES, series } from './helpers/builders';

const DAYS = ['2026-02-03', '2026-03-10', '2026-04-15', '2026-05-20', '2026-06-25', '2026-07-30', '2026-08-31', '2026-09-30'];

const BASIC_OPS = ['income', 'businessCost', 'salary', 'expense', 'save', 'unsave', 'invest', 'allocate'] as const;
const DEBT_OPS = ['cardBuy', 'cardBill', 'loanStart', 'loanPay', 'sell', 'investIncome', 'takeCash'] as const;
const ALL_OPS = [...BASIC_OPS, ...DEBT_OPS] as const;

type Operation =
  | { op: (typeof ALL_OPS)[number]; amount: number; day: number; which: number }
  | { op: 'reverse'; pick: number; day: number };

/** Few distinct amounts make payments, sales and reserves line up often enough to be exercised. */
const SMALL_AMOUNTS = [100, 200, 300, 500, 1_000, 2_000] as const;

const operationOf = (ops: readonly string[], amounts: fc.Arbitrary<number>) => fc.oneof(
  {
    weight: 9,
    arbitrary: fc.record({
      op: fc.constantFrom(...ops),
      amount: amounts,
      day: fc.integer({ min: 0, max: DAYS.length - 1 }),
      which: fc.integer({ min: 0, max: 1 }),
    }),
  },
  { weight: 1, arbitrary: fc.record({ op: fc.constant('reverse' as const), pick: fc.nat(), day: fc.integer({ min: 0, max: DAYS.length - 1 }) }) },
) as fc.Arbitrary<Operation>;

const operation = operationOf(BASIC_OPS, fc.integer({ min: 1, max: 5_000_000 }));
const anyOperation = operationOf(ALL_OPS, fc.constantFrom(...SMALL_AMOUNTS));

function build(input: Operation, id: string, existing: Transaction[]): Transaction | null {
  const date = DAYS[input.day]!;
  if (input.op === 'reverse') {
    const candidates = existing.filter((t) => t.kind !== 'reversal');
    const original = candidates[input.pick % Math.max(1, candidates.length)];
    if (!original) return null;
    return { id, kind: 'reversal', date: date > original.date ? date : original.date, amount: original.amount, reversesId: original.id };
  }
  return buildForward(input.op, { id, date, amount: input.amount, which: input.which });
}

function buildForward(op: (typeof ALL_OPS)[number], t: { id: string; date: string; amount: number; which: number }): Transaction {
  const { id, date, amount } = t;
  const holdingId = `h${t.which}`;
  const line = { debtId: `line${t.which}`, paymentMethod: 'credit_line' as const };
  const loan = { debtId: `loan${t.which}`, paymentMethod: 'installment' as const };
  const builders: Record<(typeof ALL_OPS)[number], Transaction> = {
    income: { id, kind: 'income', date, amount },
    businessCost: { id, kind: 'business_cost', date, amount, businessCostCategory: 'tools' },
    salary: { id, kind: 'salary_payment', date, amount, salaryPeriod: date.slice(0, 7), advanceInstallment: 0 },
    expense: { id, kind: 'expense', date, amount, expenseCategory: 'wants' },
    save: { id, kind: 'savings_deposit', date, amount },
    unsave: { id, kind: 'savings_withdrawal', date, amount },
    invest: { id, kind: 'investment_contribution', date, amount, holdingId },
    allocate: { id, kind: 'surplus_allocation', date, amount, account: 'savings' },
    cardBuy: { id, kind: 'expense', date, amount, expenseCategory: 'needs', ...line },
    cardBill: { id, kind: 'debt_payment', date, amount, sourceAccount: 'personal', reservePart: Math.floor(amount / 2), ...line },
    loanStart: { id, kind: 'loan_start', date, amount, totalOwed: Math.floor(amount * 1.1), destinationAccount: t.which ? 'pool' : 'personal', ...loan },
    loanPay: { id, kind: 'debt_payment', date, amount, sourceAccount: t.which ? 'pool' : 'personal', ...loan },
    sell: { id, kind: 'investment_sale', date, amount, holdingId, costRemoved: Math.floor(amount / 2), destinationAccount: 'personal' },
    investIncome: { id, kind: 'investment_income', date, amount, holdingId },
    takeCash: { id, kind: 'investment_cash_withdrawal', date, amount, holdingId, destinationAccount: 'savings' },
  };
  return builders[op];
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
  it('never lets the Pool, savings, a holding, a bill reserve or a debt end any day negative', () => {
    fc.assert(
      fc.property(fc.array(anyOperation, { minLength: 20, maxLength: 80 }), (operations) => {
        const movements = allMovements(applyAll(operations));
        for (const date of DAYS) {
          expect(findShortfall(movements.filter((m) => m.date <= date))).toBeNull();
        }
      }),
      { numRuns: 400 },
    );
  });

  it('reverses each transaction at most once and never reverses a reversal', () => {
    fc.assert(
      fc.property(fc.array(operation, { minLength: 10, maxLength: 60 }), (operations) => {
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
      fc.property(fc.array(operation, { minLength: 10, maxLength: 60 }), (operations) => {
        const active = activeTransactions(applyAll(operations));
        const total = (kind: Transaction['kind']) => active.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
        const movements = allMovements(applyAll(operations));
        const everything = (['pool', 'personal', 'savings', 'investment'] as const).reduce((s, account) => s + balanceOf(movements, account), 0);
        expect(everything).toBe(total('income') - total('business_cost') - total('expense'));
      }),
      { numRuns: 300 },
    );
  });

  it('never allows a debit larger than maxDebitAllowed to pass validation', () => {
    fc.assert(
      fc.property(fc.array(operation, { minLength: 5, maxLength: 40 }), fc.integer({ min: 0, max: DAYS.length - 1 }), (operations, day) => {
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

describe('M0.1 invariants', () => {
  const TODAY = '2026-10-09';

  it('adds the shares of a yearly charge up to exactly its amount, over 12 months', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_000_000_000 }), fc.integer({ min: 0, max: 40 }), (amount, offset) => {
        const shares = spreadCharge(amount, 'yearly', addMonths('2024-01', offset));
        expect(shares).toHaveLength(12);
        expect(sum(shares.map((x) => x.amount))).toBe(amount);
        expect(Math.min(...shares.map((x) => x.amount))).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it('never counts loan money, investment income, sale proceeds or transfers as income', () => {
    fc.assert(
      fc.property(fc.array(anyOperation, { minLength: 20, maxLength: 80 }), (operations) => {
        const book = applyAll(operations);
        const onlyWork = book.filter((t) => ['income', 'business_cost', 'reversal'].includes(t.kind));
        expect(netIncomeSeries(book, [], TODAY)).toEqual(netIncomeSeries(onlyWork, [], TODAY));
      }),
      { numRuns: 300 },
    );
  });

  it('leaves the Pool and everything the salary engine reads unchanged by investment records', () => {
    const investmentKinds = ['investment_contribution', 'investment_sale', 'investment_income', 'investment_cash_withdrawal'];
    fc.assert(
      fc.property(fc.array(anyOperation, { minLength: 20, maxLength: 80 }), (operations) => {
        const book = applyAll(operations);
        const removed = new Set(book.filter((t) => investmentKinds.includes(t.kind)).map((t) => t.id));
        const without = book.filter((t) => !removed.has(t.id) && !removed.has(t.reversesId ?? ''));
        const poolOf = (b: Transaction[]) => balanceOf(allMovements(b), 'pool');
        expect(poolOf(book)).toBe(poolOf(without));
        const amounts = (b: Transaction[]) => amountsOf(netIncomeSeries(b, [], TODAY));
        expect(amounts(book)).toEqual(amounts(without));
        const recommended = (b: Transaction[]) => recommendSalary(amounts(b), poolOf(b))?.amount ?? null;
        expect(recommended(book)).toBe(recommended(without));
      }),
      { numRuns: 300 },
    );
  });

  describe('own Pool', () => {
    const personal: InstallmentLoan = {
      id: 'loan0', purpose: 'personal', received: 3_000_000, installmentAmount: 550_000, installmentCount: 6,
      frequency: 'monthly', startDate: '2026-01-01', firstDueDate: '2026-02-01',
    };
    const business: InstallmentLoan = { ...personal, id: 'loan1', purpose: 'business' };

    it('is never above the Pool, never negative, and business principal never exceeds what is owed', () => {
      fc.assert(
        fc.property(fc.array(anyOperation, { minLength: 20, maxLength: 80 }), (operations) => {
          const book = applyAll(operations);
          const pool = balanceOf(allMovements(book), 'pool');
          const principal = businessPrincipalOwed([personal, business], book);
          expect(principal).toBeGreaterThanOrEqual(0);
          expect(principal).toBeLessThanOrEqual(owedOn(book, 'loan1'));
          expect(ownPool(pool, principal)).toBeLessThanOrEqual(pool);
          expect(ownPool(pool, principal)).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 300 },
      );
    });

    it('lets principal fall as installments are paid, and reach 0 when all are paid', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 8 }), (installments) => {
          const paid = Math.min(installments, 6) * business.installmentAmount;
          const owed = principalOwed(business, paid);
          expect(owed).toBeLessThanOrEqual(business.received);
          expect(owed).toBeGreaterThanOrEqual(0);
          if (installments >= 6) expect(owed).toBe(0);
          expect(totalPaidOn([], 'x')).toBe(0);
          expect(totalToRepay(business)).toBe(3_300_000);
        }),
      );
    });
  });
});
