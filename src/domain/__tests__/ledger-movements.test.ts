import { allMovements, movementsOf } from '../ledger-movements';
import { Movement, Transaction, TransactionKind } from '../ledger-types';
import { income, reversalOf, salaryPayment, tx } from './helpers/builders';

/** "account" or "account:ref" -> signed amount. */
function summary(movements: Movement[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const m of movements) {
    const key = m.refId ? `${m.account}:${m.refId}` : m.account;
    result[key] = (result[key] ?? 0) + m.amount;
  }
  return result;
}

const LINE = { debtId: 'line1' };
const LOAN = { debtId: 'loan1' };

describe('movements per transaction kind', () => {
  const cases: [string, TransactionKind, Partial<Transaction>, Record<string, number>][] = [
    ['opening balance on savings', 'opening_balance', { account: 'savings' }, { savings: 100 }],
    ['opening balance on a debt', 'opening_balance', { account: 'debt', ...LINE }, { 'debt:line1': 100 }],
    ['opening balance on a holding', 'opening_balance', { account: 'investment', holdingId: 'h1' }, { 'investment:h1': 100 }],
    ['bill reserve set aside', 'bill_reserve_set_aside', LINE, { personal: -100, 'bill_reserve:line1': 100 }],
    ['income', 'income', {}, { pool: 100 }],
    ['business cost', 'business_cost', {}, { pool: -100 }],
    ['salary payment', 'salary_payment', {}, { pool: -100, personal: 100 }],
    ['expense paid from Available Spending', 'expense', {}, { personal: -100 }],
    ['expense with an explicit "available" method', 'expense', { paymentMethod: 'available' }, { personal: -100 }],
    ['expense on a credit line', 'expense', { paymentMethod: 'credit_line', ...LINE },
      { personal: -100, 'bill_reserve:line1': 100, 'debt:line1': 100 }],
    ['installment purchase expense (the loan carries the debt)', 'expense', { paymentMethod: 'installment', ...LOAN }, {}],
    ['credit line interest', 'debt_cost', { paymentMethod: 'credit_line', ...LINE },
      { personal: -100, 'bill_reserve:line1': 100, 'debt:line1': 100 }],
    ['loan late fee', 'debt_cost', { paymentMethod: 'installment', ...LOAN }, { 'debt:loan1': 100 }],
    ['bill paid from Available Spending (60 from the reserve)', 'debt_payment',
      { paymentMethod: 'credit_line', sourceAccount: 'personal', reservePart: 60, ...LINE },
      { 'debt:line1': -100, 'bill_reserve:line1': -60, personal: -40 }],
    ['bill paid from the Pool (60 returned from the reserve)', 'debt_payment',
      { paymentMethod: 'credit_line', sourceAccount: 'pool', reservePart: 60, ...LINE },
      { 'debt:line1': -100, 'bill_reserve:line1': -60, pool: -100, personal: 60 }],
    ['bill fully covered by the reserve', 'debt_payment',
      { paymentMethod: 'credit_line', sourceAccount: 'personal', reservePart: 100, ...LINE },
      { 'debt:line1': -100, 'bill_reserve:line1': -100 }],
    ['personal loan installment', 'debt_payment', { paymentMethod: 'installment', sourceAccount: 'personal', ...LOAN },
      { 'debt:loan1': -100, personal: -100 }],
    ['business loan installment', 'debt_payment', { paymentMethod: 'installment', sourceAccount: 'pool', ...LOAN },
      { 'debt:loan1': -100, pool: -100 }],
    ['early payoff (paid 100, cleared 130)', 'debt_payoff',
      { paymentMethod: 'installment', sourceAccount: 'personal', clearedAmount: 130, ...LOAN },
      { personal: -100, 'debt:loan1': -130 }],
    ['personal cash loan (received 100, repay 130)', 'loan_start', { totalOwed: 130, destinationAccount: 'personal', ...LOAN },
      { 'debt:loan1': 130, personal: 100 }],
    ['business loan', 'loan_start', { totalOwed: 130, destinationAccount: 'pool', ...LOAN }, { 'debt:loan1': 130, pool: 100 }],
    ['installment purchase loan (no cash)', 'loan_start', { totalOwed: 130, ...LOAN }, { 'debt:loan1': 130 }],
    ['conversion of a purchase to installments', 'credit_conversion',
      { reservePart: 60, totalOwed: 120, targetDebtId: 'loan1', ...LINE },
      { 'bill_reserve:line1': -60, personal: 60, 'debt:line1': -100, 'debt:loan1': 120 }],
    ['savings deposit', 'savings_deposit', {}, { personal: -100, savings: 100 }],
    ['savings withdrawal', 'savings_withdrawal', {}, { savings: -100, personal: 100 }],
    ['investment contribution', 'investment_contribution', { holdingId: 'h1' }, { personal: -100, 'investment:h1': 100 }],
    ['investment sale to Available Spending (cost 40)', 'investment_sale',
      { holdingId: 'h1', costRemoved: 40, destinationAccount: 'personal' }, { 'investment:h1': -40, personal: 100 }],
    ['investment sale to Savings', 'investment_sale',
      { holdingId: 'h1', costRemoved: 40, destinationAccount: 'savings' }, { 'investment:h1': -40, savings: 100 }],
    ['investment income stays with the holding', 'investment_income', { holdingId: 'h1' }, { 'investment_cash:h1': 100 }],
    ['investment cash withdrawal', 'investment_cash_withdrawal', { holdingId: 'h1', destinationAccount: 'savings' },
      { 'investment_cash:h1': -100, savings: 100 }],
    ['surplus to savings', 'surplus_allocation', { account: 'savings' }, { pool: -100, savings: 100 }],
    ['surplus to a holding', 'surplus_allocation', { account: 'investment', holdingId: 'h1' }, { pool: -100, 'investment:h1': 100 }],
    ['advance disbursement', 'advance_disbursement', {}, { pool: -100, personal: 100 }],
    ['advance early repayment', 'advance_early_repayment', {}, { personal: -100, pool: 100 }],
  ];

  it.each(cases)('%s', (_name, kind, extra, expected) => {
    expect(summary(movementsOf(tx(kind, 100, extra)))).toEqual(expected);
  });

  it('omits zero-amount movements', () => {
    expect(movementsOf(salaryPayment(0, '2026-10', '2026-10-25', 500_000))).toEqual([]);
  });

  it('refuses a transaction that lacks what its movements need', () => {
    expect(() => movementsOf(tx('debt_payment', 100, { paymentMethod: 'installment', ...LOAN }))).toThrow(/sourceAccount/);
    expect(() => movementsOf(tx('credit_conversion', 100, { reservePart: 0, ...LINE }))).toThrow();
    expect(() => movementsOf(tx('expense', 100, { paymentMethod: 'credit_line' }))).toThrow(/debtId/);
  });
});

describe('reversals', () => {
  it('negates the original, keeping the reference ids', () => {
    const original = tx('expense', 100, { paymentMethod: 'credit_line', ...LINE });
    const result = movementsOf(reversalOf(original, '2026-02-01'), original);
    expect(summary(result)).toEqual({ personal: 100, 'bill_reserve:line1': -100, 'debt:line1': -100 });
  });

  it('negates a savings deposit', () => {
    const original = tx('savings_deposit', 100);
    expect(summary(movementsOf(reversalOf(original, '2026-02-01'), original))).toEqual({ personal: 100, savings: -100 });
  });

  it('removes only the given pool part for an income reversal', () => {
    const original = income(100);
    expect(summary(movementsOf(reversalOf(original, '2026-02-01', 30), original))).toEqual({ pool: -30 });
  });

  it('refuses a reversal without its original', () => {
    expect(() => movementsOf(reversalOf(income(100), '2026-02-01'))).toThrow();
  });

  it('derives movements for a whole book, matching reversals to their originals', () => {
    const original = income(100);
    const book = [original, reversalOf(original, '2026-02-01')];
    expect(summary(allMovements(book))).toEqual({ pool: 0 });
  });
});
