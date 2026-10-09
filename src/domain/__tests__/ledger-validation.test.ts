import { Transaction } from '../ledger-types';
import { validateTransactions } from '../ledger-validation';
import { RULES, businessCost, expense, income, opening, reversalOf, salaryPayment, tx } from './helpers/builders';

const check = (t: Transaction, existing: Transaction[] = []) => validateTransactions(existing, [t], RULES);
const LOAN = { debtId: 'loan1', paymentMethod: 'installment' as const };
const LINE = { debtId: 'line1', paymentMethod: 'credit_line' as const };

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
    expect(validateTransactions(existing, [businessCost(500, '2026-03-10')], RULES))
      .toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE', date: '2026-03-20', shortfall: 400 });
  });

  it('protects savings but lets personal spending go negative', () => {
    expect(check(tx('savings_withdrawal', 10))).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE', account: 'savings' });
    expect(check(expense(50_000, '2026-02-01'))).toEqual({ ok: true });
  });
});

describe('never-negative debts, reserves and holdings', () => {
  it('rejects paying more than is owed', () => {
    const owed = [tx('loan_start', 1_000, { totalOwed: 1_300, destinationAccount: 'personal', ...LOAN })];
    const pay = (amount: number) => tx('debt_payment', amount, { sourceAccount: 'personal', ...LOAN });
    expect(check(pay(1_300), owed)).toEqual({ ok: true });
    expect(check(pay(1_301), owed)).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE', account: 'debt', refId: 'loan1', shortfall: 1 });
  });

  it('rejects taking more from the bill reserve than is set aside', () => {
    const purchase = tx('expense', 500, { expenseCategory: 'wants', ...LINE });
    const pay = tx('debt_payment', 500, { sourceAccount: 'personal', reservePart: 600, ...LINE });
    expect(check(pay, [purchase])).toMatchObject({ code: 'MISSING_FIELD' });
    const converted = tx('credit_conversion', 500, { reservePart: 500, totalOwed: 560, targetDebtId: 'loan9', ...LINE });
    const second = tx('credit_conversion', 500, { reservePart: 500, totalOwed: 560, targetDebtId: 'loan8', ...LINE });
    expect(check(second, [purchase, converted])).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE' });
  });

  it('rejects selling more cost than a holding has', () => {
    const bought = [tx('investment_contribution', 300, { holdingId: 'h1' })];
    const sell = (cost: number) => tx('investment_sale', 400, { holdingId: 'h1', costRemoved: cost, destinationAccount: 'personal' });
    expect(check(sell(300), bought)).toEqual({ ok: true });
    expect(check(sell(301), bought)).toMatchObject({ ok: false, account: 'investment', refId: 'h1', shortfall: 1 });
  });

  it('allows a sale at a total loss for 0', () => {
    const bought = [tx('investment_contribution', 300, { holdingId: 'h1' })];
    const writeOff = tx('investment_sale', 0, { holdingId: 'h1', costRemoved: 300, destinationAccount: 'personal' });
    expect(check(writeOff, bought)).toEqual({ ok: true });
    expect(check({ ...writeOff, costRemoved: 0 }, bought)).toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('keeps cash income of one holding apart from another', () => {
    const earned = [tx('investment_income', 100, { holdingId: 'h1' })];
    const take = (holdingId: string) => tx('investment_cash_withdrawal', 100, { holdingId, destinationAccount: 'savings' });
    expect(check(take('h1'), earned)).toEqual({ ok: true });
    expect(check(take('h2'), earned)).toMatchObject({ ok: false, refId: 'h2' });
  });
});

describe('structural validation', () => {
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
});

describe('required fields per kind', () => {
  const missing = (t: Transaction) => expect(check(t)).toMatchObject({ code: 'MISSING_FIELD' });

  it('needs the basics for existing kinds', () => {
    missing(tx('expense', 10));
    missing(tx('business_cost', 10));
    missing(tx('opening_balance', 10));
    missing(tx('opening_balance', 10, { account: 'debt' }));
    missing(tx('surplus_allocation', 10, { account: 'personal' }));
    missing(tx('surplus_allocation', 10, { account: 'investment' }));
    missing(tx('salary_payment', 10));
    missing(tx('advance_disbursement', 10));
    missing(tx('advance_early_repayment', 10));
    missing(tx('reversal', 10));
  });

  it('asks a subscription cost for its billing cycle, and nothing else for other categories', () => {
    missing(tx('business_cost', 10, { businessCostCategory: 'subscription' }));
    expect(check(tx('business_cost', 10, { businessCostCategory: 'subscription', billingCycle: 'yearly', date: '2026-02-01' }), [income(10, '2026-01-20')]))
      .toEqual({ ok: true });
    expect(check(tx('business_cost', 10, { businessCostCategory: 'tools', date: '2026-02-01' }), [income(10, '2026-01-20')])).toEqual({ ok: true });
  });

  it('needs a debt for credit-line and installment expenses', () => {
    missing(tx('expense', 10, { expenseCategory: 'wants', paymentMethod: 'credit_line' }));
    missing(tx('expense', 10, { expenseCategory: 'wants', paymentMethod: 'installment' }));
    expect(check(tx('expense', 10, { expenseCategory: 'wants', paymentMethod: 'installment', debtId: 'loan1', date: '2026-02-01' }))).toEqual({ ok: true });
  });

  it('needs debt details', () => {
    missing(tx('bill_reserve_set_aside', 10));
    missing(tx('debt_cost', 10, { debtId: 'd1', paymentMethod: 'credit_line' }));
    missing(tx('debt_cost', 10, { debtId: 'd1', debtCostType: 'fee' }));
    missing(tx('debt_payment', 10, { ...LOAN, reservePart: 5, sourceAccount: 'personal' }));
    missing(tx('debt_payment', 10, { ...LINE, sourceAccount: 'savings' as never }));
    missing(tx('debt_payoff', 10, { ...LOAN, sourceAccount: 'personal' }));
    missing(tx('loan_start', 10, { debtId: 'd1', totalOwed: 5 }));
    missing(tx('loan_start', 10, { debtId: 'd1', totalOwed: 10, destinationAccount: 'savings' }));
    missing(tx('credit_conversion', 10, { ...LINE, targetDebtId: 'line1', reservePart: 0, totalOwed: 10 }));
    missing(tx('credit_conversion', 10, { ...LINE, targetDebtId: 'loan1', reservePart: 20, totalOwed: 10 }));
  });

  it('needs investment details', () => {
    missing(tx('investment_contribution', 10));
    missing(tx('investment_sale', 10, { holdingId: 'h1', costRemoved: 5 }));
    missing(tx('investment_sale', 10, { holdingId: 'h1', destinationAccount: 'personal' }));
    missing(tx('investment_income', 10));
    missing(tx('investment_cash_withdrawal', 10, { holdingId: 'h1' }));
    missing(tx('investment_cash_withdrawal', 10, { holdingId: 'h1', destinationAccount: 'pool' }));
  });
});

describe('reversals', () => {
  const original = expense(300, '2026-02-01');

  it('reverses a transaction exactly once', () => {
    const first = reversalOf(original, '2026-02-02');
    expect(validateTransactions([original], [first], RULES)).toEqual({ ok: true });
    expect(validateTransactions([original, first], [reversalOf(original, '2026-02-03')], RULES)).toMatchObject({ code: 'ALREADY_REVERSED' });
  });

  it('never reverses a reversal', () => {
    const reversal = reversalOf(original, '2026-02-02');
    expect(validateTransactions([original, reversal], [reversalOf(reversal, '2026-02-03')], RULES)).toMatchObject({ code: 'NOT_REVERSIBLE' });
  });

  it('needs an existing original, a matching amount and a sensible date', () => {
    expect(validateTransactions([], [reversalOf(original, '2026-02-02')], RULES)).toMatchObject({ code: 'ORIGINAL_NOT_FOUND' });
    expect(validateTransactions([original], [reversalOf(original, '2026-02-02', 100)], RULES)).toMatchObject({ code: 'REVERSAL_AMOUNT_MISMATCH' });
    expect(validateTransactions([original], [reversalOf(original, '2026-01-20')], RULES)).toMatchObject({ code: 'INVALID_DATE' });
  });

  it('lets only an income reversal be partial', () => {
    const received = income(1_000, '2026-02-01');
    expect(validateTransactions([received], [reversalOf(received, '2026-02-02', 400)], RULES)).toEqual({ ok: true });
    expect(validateTransactions([received], [reversalOf(received, '2026-02-02', 1_001)], RULES)).toMatchObject({ code: 'REVERSAL_AMOUNT_MISMATCH' });
  });

  it('rejects a reversal that would make the Pool negative', () => {
    const received = income(1_000, '2026-02-01');
    const paid = salaryPayment(800, '2026-02', '2026-02-10');
    expect(validateTransactions([received, paid], [reversalOf(received, '2026-02-20')], RULES))
      .toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE', account: 'pool', shortfall: 800 });
  });

  it('rejects reversing a credit purchase whose reserve was already used', () => {
    const purchase = tx('expense', 500, { expenseCategory: 'wants', date: '2026-02-01', ...LINE });
    const bill = tx('debt_payment', 500, { sourceAccount: 'personal', reservePart: 500, date: '2026-02-20', ...LINE });
    expect(validateTransactions([purchase, bill], [reversalOf(purchase, '2026-02-25')], RULES)).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE' });
  });

  it('judges a correction by its final state (reversal + replacement as one batch)', () => {
    const received = income(1_000, '2026-02-01');
    const paid = salaryPayment(800, '2026-02', '2026-02-10');
    const reversal = reversalOf(received, '2026-02-20');
    const replacement = income(1_500, '2026-02-01');
    expect(validateTransactions([received, paid], [reversal], RULES)).toMatchObject({ ok: false });
    expect(validateTransactions([received, paid], [reversal, replacement], RULES)).toEqual({ ok: true });
  });
});
