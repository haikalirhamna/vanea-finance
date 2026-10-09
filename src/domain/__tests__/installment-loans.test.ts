import {
  InstallmentLoan, approximateYearlyRate, businessLoanCommitment, businessLoanCostsByMonth, businessPrincipalOwed,
  costOfBorrowing, dueDates, earlyPayoffSaving, installmentsPaid, interestByMonth, interestPaidThrough, interestShare,
  owedOn, principalOwed, totalPaidOn, totalToRepay, unpaidInstallments, validateLoanTerms,
} from '../installment-loans';
import { Transaction } from '../ledger-types';
import { tx } from './helpers/builders';

const loan: InstallmentLoan = {
  id: 'loan1', purpose: 'personal', received: 3_000_000, installmentAmount: 550_000, installmentCount: 6,
  frequency: 'monthly', startDate: '2026-09-02', firstDueDate: '2026-10-02',
};
const onlineLoan: InstallmentLoan = {
  id: 'pinjol', purpose: 'personal', received: 2_000_000, installmentAmount: 2_600_000, installmentCount: 1,
  frequency: 'single', startDate: '2026-09-01', firstDueDate: '2026-10-01',
};

const start = (l: InstallmentLoan, date = '2026-09-02'): Transaction =>
  tx('loan_start', l.received, { debtId: l.id, paymentMethod: 'installment', totalOwed: totalToRepay(l), destinationAccount: l.purpose === 'business' ? 'pool' : 'personal', date });
const pay = (l: InstallmentLoan, amount: number, date: string): Transaction =>
  tx('debt_payment', amount, { debtId: l.id, paymentMethod: 'installment', sourceAccount: l.purpose === 'business' ? 'pool' : 'personal', date });

describe('terms', () => {
  it('computes the total and the cost of borrowing', () => {
    expect(totalToRepay(loan)).toBe(3_300_000);
    expect(costOfBorrowing(loan)).toBe(300_000);
    expect(costOfBorrowing(onlineLoan)).toBe(600_000);
  });

  it('accepts sensible terms and rejects the rest', () => {
    expect(validateLoanTerms(loan)).toEqual({ ok: true });
    expect(validateLoanTerms({ ...loan, received: 0 })).toEqual({ ok: false, code: 'INVALID_AMOUNT' });
    expect(validateLoanTerms({ ...loan, installmentAmount: 0 })).toEqual({ ok: false, code: 'INVALID_INSTALLMENT' });
    expect(validateLoanTerms({ ...loan, installmentCount: 0 })).toEqual({ ok: false, code: 'INVALID_COUNT' });
    expect(validateLoanTerms({ ...loan, installmentCount: 1.5 })).toEqual({ ok: false, code: 'INVALID_COUNT' });
    expect(validateLoanTerms({ ...onlineLoan, installmentCount: 2 })).toEqual({ ok: false, code: 'SINGLE_NEEDS_ONE_INSTALLMENT' });
    expect(validateLoanTerms({ ...loan, installmentAmount: 100_000 })).toEqual({ ok: false, code: 'REPAYS_LESS_THAN_RECEIVED' });
    expect(validateLoanTerms({ ...loan, firstDueDate: '2026-09-01' })).toEqual({ ok: false, code: 'DUE_BEFORE_START' });
  });

  it('allows an interest-free loan', () => {
    const free = { ...loan, installmentAmount: 500_000 };
    expect(costOfBorrowing(free)).toBe(0);
    expect(validateLoanTerms(free)).toEqual({ ok: true });
    expect(approximateYearlyRate(free)).toBe(0);
  });
});

describe('approximateYearlyRate', () => {
  it('reproduces the PRD example: Rp 2.000.000 repaid as Rp 2.600.000 in 30 days is about 365% a year', () => {
    expect(approximateYearlyRate(onlineLoan)).toBeCloseTo(3.65, 6);
  });

  it('is the monthly rate times 12 for monthly loans', () => {
    expect(approximateYearlyRate(loan)).toBeCloseTo(0.3352, 3);
    expect(approximateYearlyRate({ ...loan, received: 12_000_000, installmentAmount: 1_100_000, installmentCount: 12 })).toBeCloseTo(0.1797, 3);
  });

  it('grows with the cost', () => {
    expect(approximateYearlyRate({ ...loan, installmentAmount: 700_000 })).toBeGreaterThan(approximateYearlyRate(loan));
  });
});

describe('schedule', () => {
  it('lists monthly due dates keeping the day, clamped in short months', () => {
    expect(dueDates(loan)).toEqual(['2026-10-02', '2026-11-02', '2026-12-02', '2027-01-02', '2027-02-02', '2027-03-02']);
    expect(dueDates({ ...loan, firstDueDate: '2026-12-31', installmentCount: 3 })).toEqual(['2026-12-31', '2027-01-31', '2027-02-28']);
    expect(dueDates(onlineLoan)).toEqual(['2026-10-01']);
  });

  it('splits interest evenly, the last installment taking the remainder', () => {
    expect(interestShare(loan, 1)).toBe(50_000);
    expect(interestShare(loan, 6)).toBe(50_000);
    const odd = { ...loan, installmentAmount: 551_000, installmentCount: 6 };
    expect([1, 2, 3, 4, 5, 6].map((k) => interestShare(odd, k))).toEqual([51_000, 51_000, 51_000, 51_000, 51_000, 51_000]);
    const remainder = { ...loan, received: 1_000, installmentAmount: 200, installmentCount: 6 };
    expect([1, 6].map((k) => interestShare(remainder, k))).toEqual([33, 35]);
  });

  it('counts paid installments, never beyond the total', () => {
    expect(installmentsPaid(loan, 0)).toBe(0);
    expect(installmentsPaid(loan, 1_099_999)).toBe(1);
    expect(installmentsPaid(loan, 99_000_000)).toBe(6);
  });
});

describe('interest and principal', () => {
  it('counts interest as installments are paid, pro rata for a part-paid one', () => {
    expect(interestPaidThrough(loan, 0)).toBe(0);
    expect(interestPaidThrough(loan, 550_000)).toBe(50_000);
    expect(interestPaidThrough(loan, 1_100_000)).toBe(100_000);
    expect(interestPaidThrough(loan, 1_375_000)).toBe(125_000);
    expect(interestPaidThrough(loan, 3_300_000)).toBe(300_000);
    expect(interestPaidThrough(loan, 9_000_000)).toBe(300_000);
  });

  it('shows the principal still owed', () => {
    expect(principalOwed(loan, 0)).toBe(3_000_000);
    // Each installment of 550.000 holds 50.000 of interest, so two repay Rp 1.000.000 of principal.
    expect(principalOwed(loan, 1_100_000)).toBe(2_000_000);
    expect(principalOwed(loan, 3_300_000)).toBe(0);
  });

  it('lists unpaid installments, capped by what is owed', () => {
    const result = unpaidInstallments(loan, 1_100_000, 2_200_000);
    expect(result.map((u) => u.number)).toEqual([3, 4, 5, 6]);
    expect(result[0]).toEqual({ number: 3, date: '2026-12-02', amount: 550_000 });
    expect(unpaidInstallments(loan, 1_100_000, 700_000).map((u) => u.amount)).toEqual([550_000, 150_000]);
    expect(unpaidInstallments(loan, 3_300_000, 0)).toEqual([]);
  });

  it('computes the interest saved by paying off early', () => {
    expect(earlyPayoffSaving(2_200_000, 2_050_000)).toBe(150_000);
    expect(earlyPayoffSaving(100, 500)).toBe(0);
  });
});

describe('from transactions', () => {
  it('knows what is owed and what has been paid', () => {
    const book = [start(loan), pay(loan, 550_000, '2026-10-02'), pay(loan, 550_000, '2026-11-02')];
    expect(owedOn(book, 'loan1')).toBe(2_200_000);
    expect(totalPaidOn(book, 'loan1')).toBe(1_100_000);
  });

  it('assigns the interest of each payment to its month', () => {
    const book = [start(loan), pay(loan, 550_000, '2026-10-02'), pay(loan, 275_000, '2026-11-02'), pay(loan, 275_000, '2026-11-20')];
    expect([...interestByMonth(loan, book)]).toEqual([['2026-10', 50_000], ['2026-11', 50_000]]);
  });

  it('counts a payoff\'s interest as what it pays beyond the principal', () => {
    const payoff = tx('debt_payoff', 2_200_000, { debtId: 'loan1', paymentMethod: 'installment', sourceAccount: 'personal', clearedAmount: 2_200_000, date: '2026-12-02' });
    const book = [start(loan), pay(loan, 550_000, '2026-10-02'), pay(loan, 550_000, '2026-11-02'), payoff];
    // Rp 2.200.000 paid against Rp 2.000.000 of principal left: Rp 200.000 of interest (100.000 + 200.000 = the full cost).
    expect(interestByMonth(loan, book).get('2026-12')).toBe(200_000);
    const atPrincipal = { ...payoff, amount: 2_000_000 };
    expect(interestByMonth(loan, [start(loan), pay(loan, 550_000, '2026-10-02'), pay(loan, 550_000, '2026-11-02'), atPrincipal]).get('2026-12')).toBe(0);
  });
});

describe('business loans', () => {
  const business: InstallmentLoan = { ...loan, id: 'biz', purpose: 'business' };
  const book = [start(business), pay(business, 550_000, '2026-10-02')];

  it('owes principal that is not the user\'s money, until repaid', () => {
    expect(businessPrincipalOwed([business], book)).toBe(2_500_000);
    expect(businessPrincipalOwed([business], [start(business)])).toBe(3_000_000);
  });

  it('ignores personal loans and closed loans', () => {
    expect(businessPrincipalOwed([loan], [start(loan)])).toBe(0);
    const settled = [start(business), ...dueDates(business).map((date) => pay(business, 550_000, date))];
    expect(businessPrincipalOwed([business], settled)).toBe(0);
  });

  it('counts interest and late fees as a business cost by month', () => {
    const fee = tx('debt_cost', 25_000, { debtId: 'biz', paymentMethod: 'installment', debtCostType: 'late_fee', date: '2026-11-05' });
    expect([...businessLoanCostsByMonth([business, loan], [...book, fee])]).toEqual([['2026-10', 50_000], ['2026-11', 25_000]]);
  });

  it('adds open monthly business installments to the commitments', () => {
    expect(businessLoanCommitment([business, loan], book)).toBe(550_000);
    expect(businessLoanCommitment([business], [])).toBe(0);
    expect(businessLoanCommitment([{ ...business, frequency: 'single', installmentCount: 1 }], book)).toBe(0);
  });
});
