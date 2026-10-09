import {
  CreditLine, amountDue, availableCredit, billDueDate, billReserveOf, latestStatementDate, olderDebt, owedOnLine,
  planBillPayment, planConversion, statementBalance, totalBillReserve,
} from '../credit-lines';
import { Transaction } from '../ledger-types';
import { tx } from './helpers/builders';

const line: CreditLine = { id: 'line1', statementDay: 20, dueDay: 5, limit: 5_000_000 };
const LINE = { debtId: 'line1', paymentMethod: 'credit_line' as const };

const purchase = (amount: number, date: string): Transaction =>
  tx('expense', amount, { expenseCategory: 'wants', date, ...LINE });
const bill = (amount: number, reservePart: number, date: string, sourceAccount: 'personal' | 'pool' = 'personal'): Transaction =>
  tx('debt_payment', amount, { sourceAccount, reservePart, date, ...LINE });

describe('owed and reserve', () => {
  const book = [purchase(1_200_000, '2026-09-10'), purchase(300_000, '2026-09-25')];

  it('moves purchases into the bill reserve and the owed amount together', () => {
    expect(owedOnLine(book, 'line1')).toBe(1_500_000);
    expect(billReserveOf(book, 'line1')).toBe(1_500_000);
    expect(totalBillReserve(book)).toBe(1_500_000);
  });

  it('keeps lines apart', () => {
    expect(owedOnLine(book, 'other')).toBe(0);
  });

  it('shows an older, not yet set aside balance', () => {
    expect(olderDebt(1_500_000, 1_200_000)).toBe(300_000);
    expect(olderDebt(1_000_000, 1_200_000)).toBe(0);
    const opening = tx('opening_balance', 800_000, { account: 'debt', ...LINE, date: '2026-09-01' });
    expect(olderDebt(owedOnLine([opening, ...book], 'line1'), billReserveOf([opening, ...book], 'line1'))).toBe(800_000);
  });

  it('reports credit left under the limit without ever blocking', () => {
    expect(availableCredit(5_000_000, 1_500_000)).toBe(3_500_000);
    expect(availableCredit(5_000_000, 6_000_000)).toBe(0);
    expect(availableCredit(null, 1_500_000)).toBeNull();
  });
});

describe('statement and due date', () => {
  it('finds the latest statement date, clamped in short months', () => {
    expect(latestStatementDate('2026-10-09', 20)).toBe('2026-09-20');
    expect(latestStatementDate('2026-10-20', 20)).toBe('2026-10-20');
    expect(latestStatementDate('2026-03-05', 31)).toBe('2026-02-28');
    expect(latestStatementDate('2026-01-05', 20)).toBe('2025-12-20');
  });

  it('puts the due date in the statement month when the due day is later, else the next month', () => {
    expect(billDueDate('2026-10-09', line)).toBe('2026-10-05');
    expect(billDueDate('2026-10-09', { ...line, statementDay: 20, dueDay: 25 })).toBe('2026-09-25');
    expect(billDueDate('2026-12-25', line)).toBe('2027-01-05');
  });

  it('measures the bill at the statement, then subtracts what was paid since', () => {
    const book = [purchase(1_200_000, '2026-09-10'), purchase(300_000, '2026-09-25')];
    expect(statementBalance(book, line, '2026-10-09')).toBe(1_200_000);
    expect(amountDue(book, line, '2026-10-09')).toBe(1_200_000);
    expect(amountDue([...book, bill(700_000, 700_000, '2026-10-03')], line, '2026-10-09')).toBe(500_000);
    expect(amountDue([...book, bill(1_500_000, 1_500_000, '2026-10-03')], line, '2026-10-09')).toBe(0);
  });

  it('counts a conversion to installments as settling the bill', () => {
    const book = [purchase(1_200_000, '2026-09-10')];
    const conversion = tx('credit_conversion', 1_200_000, { reservePart: 1_200_000, totalOwed: 1_320_000, targetDebtId: 'loan1', date: '2026-10-02', ...LINE });
    expect(amountDue([...book, conversion], line, '2026-10-09')).toBe(0);
  });

  it('ignores payments made before the statement', () => {
    const book = [purchase(1_000_000, '2026-08-10'), bill(400_000, 400_000, '2026-09-01'), purchase(500_000, '2026-09-10')];
    expect(amountDue(book, line, '2026-10-09')).toBe(1_100_000);
  });
});

describe('planBillPayment', () => {
  it('pays from the reserve first and the rest from Available Spending', () => {
    expect(planBillPayment(1_500_000, 1_800_000, 1_200_000, 'personal')).toEqual({
      ok: true, reservePart: 1_200_000, fromAvailableSpending: 300_000, fromPool: 0, returnedToAvailableSpending: 0,
    });
  });

  it('pays from the Pool and hands the reserve back to Available Spending', () => {
    expect(planBillPayment(1_500_000, 1_800_000, 1_200_000, 'pool')).toEqual({
      ok: true, reservePart: 1_200_000, fromAvailableSpending: 0, fromPool: 1_500_000, returnedToAvailableSpending: 1_200_000,
    });
  });

  it('uses only as much reserve as the payment needs', () => {
    expect(planBillPayment(500_000, 1_800_000, 1_200_000, 'personal')).toMatchObject({ reservePart: 500_000, fromAvailableSpending: 0 });
  });

  it('never pays more than is owed', () => {
    expect(planBillPayment(2_000_000, 1_800_000, 0, 'personal')).toEqual({ ok: false, code: 'ABOVE_OWED', max: 1_800_000 });
    expect(planBillPayment(0, 1_800_000, 0, 'personal')).toMatchObject({ ok: false, code: 'INVALID_AMOUNT' });
    expect(planBillPayment(10.5, 1_800_000, 0, 'personal')).toMatchObject({ ok: false, code: 'INVALID_AMOUNT' });
  });
});

describe('planConversion', () => {
  const base = { purchaseAmount: 1_200_000, owed: 1_500_000, reserve: 1_500_000, installmentAmount: 110_000, installmentCount: 12 };

  it('returns the reserved money and reports the cost of the new loan', () => {
    expect(planConversion(base)).toEqual({ ok: true, reservePart: 1_200_000, totalOwed: 1_320_000, cost: 120_000 });
  });

  it('returns only the reserve that exists', () => {
    expect(planConversion({ ...base, reserve: 500_000 })).toMatchObject({ ok: true, reservePart: 500_000 });
  });

  it('rejects impossible conversions', () => {
    expect(planConversion({ ...base, purchaseAmount: 2_000_000 })).toEqual({ ok: false, code: 'ABOVE_OWED', max: 1_500_000 });
    expect(planConversion({ ...base, purchaseAmount: 0 })).toEqual({ ok: false, code: 'INVALID_AMOUNT' });
    expect(planConversion({ ...base, installmentAmount: 50_000 })).toEqual({ ok: false, code: 'REPAYS_LESS_THAN_PURCHASE' });
  });
});
