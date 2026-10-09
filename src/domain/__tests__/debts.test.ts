import { CreditLine } from '../credit-lines';
import {
  DebtBook, debtPaymentRatio, dueBeforePayday, dueInMonth, dueList, exceedsDebtRatio, installmentsLeft, totalOwed,
} from '../debts';
import { InstallmentLoan, totalToRepay } from '../installment-loans';
import { Transaction } from '../ledger-types';
import { tx } from './helpers/builders';

const TODAY = '2026-10-09';
// Statement on the 5th, bill due on the 25th: on 9 Oct the latest statement is 5 Oct and its bill is due 25 Oct.
const line: CreditLine = { id: 'paylater', statementDay: 5, dueDay: 25, limit: null };
const kredivo: InstallmentLoan = {
  id: 'kredivo', purpose: 'personal', received: 3_000_000, installmentAmount: 550_000, installmentCount: 6,
  frequency: 'monthly', startDate: '2026-08-02', firstDueDate: '2026-09-02',
};
const LINE = { debtId: 'paylater', paymentMethod: 'credit_line' as const };

const loanStart = (loan: InstallmentLoan): Transaction =>
  tx('loan_start', loan.received, { debtId: loan.id, paymentMethod: 'installment', totalOwed: totalToRepay(loan), destinationAccount: 'personal', date: loan.startDate });
const loanPayment = (loan: InstallmentLoan, date: string): Transaction =>
  tx('debt_payment', loan.installmentAmount, { debtId: loan.id, paymentMethod: 'installment', sourceAccount: 'personal', date });
const purchase = (amount: number, date: string): Transaction => tx('expense', amount, { expenseCategory: 'wants', date, ...LINE });

function book(transactions: Transaction[], loans = [kredivo], lines = [line]): DebtBook {
  return { loans, lines, transactions };
}

// One installment paid; a PayLater bill of Rp 1.200.000 on the 5 Oct statement, plus Rp 300.000 bought after it.
const typical = [
  loanStart(kredivo), loanPayment(kredivo, '2026-09-02'),
  purchase(1_200_000, '2026-09-20'), purchase(300_000, '2026-10-07'),
];

describe('totals', () => {
  it('adds up what is owed on credit lines and loans', () => {
    expect(totalOwed(book(typical))).toBe(2_750_000 + 1_500_000);
  });

  it('counts the installments left', () => {
    expect(installmentsLeft(kredivo, typical)).toBe(5);
  });
});

describe('dueList', () => {
  it('lists unpaid installments and open bills, oldest first, flagging overdue ones', () => {
    const list = dueList(book(typical), TODAY);
    expect(list.map((d) => [d.debtId, d.date, d.amount, d.overdue])).toEqual([
      ['kredivo', '2026-10-02', 550_000, true],
      ['paylater', '2026-10-25', 1_200_000, false],
      ['kredivo', '2026-11-02', 550_000, false],
      ['kredivo', '2026-12-02', 550_000, false],
      ['kredivo', '2027-01-02', 550_000, false],
      ['kredivo', '2027-02-02', 550_000, false],
    ]);
  });

  it('is empty when nothing is owed', () => {
    expect(dueList(book([]), TODAY)).toEqual([]);
  });
});

describe('dueBeforePayday', () => {
  it('sets aside unpaid installments due before payday, overdue ones included', () => {
    const sansLine = book(typical, [kredivo], []);
    expect(dueBeforePayday(sansLine, TODAY, '2026-10-25')).toBe(550_000);
    expect(dueBeforePayday(sansLine, TODAY, '2026-10-03')).toBe(550_000);
    // A due date on payday itself is not before payday.
    expect(dueBeforePayday(sansLine, TODAY, '2026-10-02')).toBe(0);
    expect(dueBeforePayday(sansLine, '2026-10-01', '2026-10-02')).toBe(0);
  });

  it('sets aside only the credit line balance that was not set aside earlier', () => {
    const older = tx('opening_balance', 400_000, { account: 'debt', date: '2026-09-01', ...LINE });
    const withOlder = book([...typical, older], [kredivo], [line]);
    // Bill due 25 Oct is before payday 26 Oct; reserve covers the purchases, the opening balance is older debt.
    expect(dueBeforePayday(withOlder, TODAY, '2026-10-26')).toBe(550_000 + 400_000);
    expect(dueBeforePayday(withOlder, TODAY, '2026-10-25')).toBe(550_000);
  });

  it('leaves out a bill that is fully covered by its reserve', () => {
    expect(dueBeforePayday(book(typical), TODAY, '2026-10-26')).toBe(550_000);
  });
});

describe('payments due in a month and the ratio', () => {
  it('adds scheduled personal installments and the statement amount of bills due that month', () => {
    expect(dueInMonth(book(typical), '2026-10', TODAY)).toBe(550_000 + 1_200_000);
    expect(dueInMonth(book(typical), '2026-11', TODAY)).toBe(550_000);
  });

  it('does not shrink as the month\'s payments are made', () => {
    const paid = [...typical, loanPayment(kredivo, '2026-10-02')];
    expect(dueInMonth(book(paid), '2026-10', TODAY)).toBe(550_000 + 1_200_000);
  });

  it('leaves out business loans (they are paid from the Pool) and settled loans', () => {
    const business = { ...kredivo, id: 'biz', purpose: 'business' as const };
    expect(dueInMonth(book([loanStart(business)], [business], []), '2026-10', TODAY)).toBe(0);
    const settled = [loanStart(kredivo), ...[...Array(6).keys()].map((k) => loanPayment(kredivo, `2026-0${k + 3}-02`))];
    expect(dueInMonth(book(settled, [kredivo], []), '2026-10', TODAY)).toBe(0);
  });

  it('divides by salary and shows the calm card only above 30%', () => {
    expect(debtPaymentRatio(1_500_000, 8_000_000)).toBeCloseTo(0.1875, 4);
    expect(debtPaymentRatio(1_000, 0)).toBeNull();
    expect(exceedsDebtRatio(0.3)).toBe(false);
    expect(exceedsDebtRatio(0.38)).toBe(true);
    expect(exceedsDebtRatio(null)).toBe(false);
  });
});
