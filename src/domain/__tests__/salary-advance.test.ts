import {
  SalaryAdvance, addRemainderToAdvance, advanceForRemainder, installmentDue, installmentFor, isRepaid,
  outstandingOf, periodsRemaining, validateEarlyRepayment, validateNewAdvance,
} from '../salary-advance';
import { reversalOf, salaryPayment, tx } from './helpers/builders';

const advance: SalaryAdvance = { id: 'adv1', amount: 3_000_000, termPeriods: 3, installmentAmount: 1_000_000, firstPeriod: '2026-10' };
const request = { amount: 3_000_000, termPeriods: 3, salary: 8_000_000, poolMax: 10_000_000, hasActiveAdvance: false };

describe('validateNewAdvance', () => {
  it('accepts an advance within salary and Pool', () => {
    expect(validateNewAdvance(request)).toEqual({ ok: true });
  });

  it('limits the amount to the salary and to what the Pool holds', () => {
    expect(validateNewAdvance({ ...request, amount: 8_000_001 })).toEqual({ ok: false, code: 'ABOVE_SALARY', max: 8_000_000 });
    expect(validateNewAdvance({ ...request, poolMax: 2_000_000 })).toEqual({ ok: false, code: 'ABOVE_POOL', max: 2_000_000 });
  });

  it('allows a term of 1 to 6 periods only', () => {
    expect(validateNewAdvance({ ...request, termPeriods: 0 })).toMatchObject({ code: 'INVALID_TERM' });
    expect(validateNewAdvance({ ...request, termPeriods: 7 })).toMatchObject({ code: 'INVALID_TERM' });
    expect(validateNewAdvance({ ...request, termPeriods: 2.5 })).toMatchObject({ code: 'INVALID_TERM' });
    expect(validateNewAdvance({ ...request, termPeriods: 6 })).toEqual({ ok: true });
  });

  it('allows one active advance at a time and a positive amount', () => {
    expect(validateNewAdvance({ ...request, hasActiveAdvance: true })).toMatchObject({ code: 'ADVANCE_ALREADY_ACTIVE' });
    expect(validateNewAdvance({ ...request, amount: 0 })).toMatchObject({ code: 'INVALID_AMOUNT' });
  });
});

describe('installments and outstanding', () => {
  it('rounds the installment up so the advance is always fully repaid', () => {
    expect(installmentFor(1_000_000, 3)).toBe(333_334);
    expect(installmentDue({ ...advance, installmentAmount: 333_334 }, 333_332)).toBe(333_332);
  });

  it('subtracts withheld installments and early repayments', () => {
    const payments = [
      salaryPayment(7_000_000, '2026-10', '2026-10-25', 1_000_000, 'adv1'),
      tx('advance_early_repayment', 500_000, { advanceId: 'adv1', date: '2026-11-02' }),
    ];
    expect(outstandingOf(advance, payments)).toBe(1_500_000);
  });

  it('ignores reversed payments and other advances', () => {
    const paid = salaryPayment(7_000_000, '2026-10', '2026-10-25', 1_000_000, 'adv1');
    const other = salaryPayment(7_000_000, '2026-11', '2026-11-25', 1_000_000, 'adv2');
    expect(outstandingOf(advance, [paid, reversalOf(paid, '2026-10-26'), other])).toBe(3_000_000);
  });

  it('knows when it is repaid and how many periods remain', () => {
    expect(isRepaid(0)).toBe(true);
    expect(isRepaid(1)).toBe(false);
    expect(periodsRemaining(advance, 2_500_000)).toBe(3);
    expect(periodsRemaining(advance, 0)).toBe(0);
  });

  it('ignores other transactions that mention the advance (such as its disbursement)', () => {
    const disbursement = tx('advance_disbursement', 3_000_000, { advanceId: 'adv1' });
    expect(outstandingOf(advance, [disbursement])).toBe(3_000_000);
  });

  it('does not push outstanding below zero', () => {
    const over = tx('advance_early_repayment', 9_000_000, { advanceId: 'adv1' });
    expect(outstandingOf(advance, [over])).toBe(0);
  });
});

describe('early repayment', () => {
  it('is limited to what is outstanding', () => {
    expect(validateEarlyRepayment(1_000_000, 2_000_000)).toEqual({ ok: true });
    expect(validateEarlyRepayment(2_000_001, 2_000_000)).toEqual({ ok: false, code: 'ABOVE_OUTSTANDING', max: 2_000_000 });
    expect(validateEarlyRepayment(0, 2_000_000)).toMatchObject({ code: 'INVALID_AMOUNT' });
  });
});

describe('income-reversal remainder', () => {
  it('creates a new advance over 3 periods by default', () => {
    expect(advanceForRemainder(1_200_000)).toEqual({ amount: 1_200_000, termPeriods: 3, installmentAmount: 400_000 });
    expect(advanceForRemainder(1_200_000, 6).installmentAmount).toBe(200_000);
  });

  it('adds to an active advance, keeping the installment so it runs longer', () => {
    expect(addRemainderToAdvance(advance, 2_000_000, 1_000_000)).toEqual({ amount: 4_000_000, installmentAmount: 1_000_000 });
  });

  it('raises the installment when the advance would run past six periods', () => {
    expect(addRemainderToAdvance(advance, 2_000_000, 9_000_000)).toEqual({ amount: 12_000_000, installmentAmount: 1_833_334 });
  });
});
