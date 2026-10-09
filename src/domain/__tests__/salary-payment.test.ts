import { AdvanceTerms, maxPaymentNow, periodPayment, planPayment } from '../salary-payment';
import { reversalOf, salaryPayment } from './helpers/builders';

const PERIOD = '2026-10';
const advance: AdvanceTerms = { firstPeriod: '2026-10', installmentAmount: 1_000_000, outstanding: 3_000_000 };

function state(transactions = [] as ReturnType<typeof salaryPayment>[], adv: AdvanceTerms | null = null, salary = 8_000_000) {
  return periodPayment({ salary, period: PERIOD, transactions, advance: adv });
}

describe('periodPayment', () => {
  it('owes the full salary when there is no advance', () => {
    expect(state()).toMatchObject({ entitlement: 8_000_000, installmentWithheld: 0, paid: 0, remaining: 8_000_000, hasPayment: false });
  });

  it('withholds the advance installment from the entitlement', () => {
    expect(state([], advance)).toMatchObject({ installmentWithheld: 1_000_000, entitlement: 7_000_000 });
  });

  it('withholds only what is left of the advance', () => {
    const last = { ...advance, outstanding: 400_000 };
    expect(state([], last)).toMatchObject({ installmentWithheld: 400_000, entitlement: 7_600_000 });
  });

  it('does not withhold before the advance starts', () => {
    const later = { ...advance, firstPeriod: '2026-11' };
    expect(state([], later).installmentWithheld).toBe(0);
  });

  it('locks the installment once the first payment is recorded', () => {
    const first = salaryPayment(3_000_000, PERIOD, '2026-10-25', 1_000_000, 'adv1');
    // The advance's outstanding has already dropped; the period's entitlement must not change.
    const afterFirst = { ...advance, outstanding: 2_000_000 };
    expect(state([first], afterFirst)).toMatchObject({ installmentWithheld: 1_000_000, entitlement: 7_000_000, paid: 3_000_000, remaining: 4_000_000 });
  });

  it('treats a payment recorded without an installment as zero withheld', () => {
    const plain = { ...salaryPayment(1_000_000, PERIOD, '2026-10-25'), advanceInstallment: undefined };
    expect(state([plain], advance)).toMatchObject({ installmentWithheld: 0, entitlement: 8_000_000 });
  });

  it('counts top-ups and ignores reversed payments and other periods', () => {
    const first = salaryPayment(3_000_000, PERIOD, '2026-10-25');
    const topUp = salaryPayment(2_000_000, PERIOD, '2026-10-28');
    const other = salaryPayment(8_000_000, '2026-09', '2026-09-25');
    const undone = salaryPayment(1_000_000, PERIOD, '2026-10-29');
    const result = state([first, topUp, other, undone, reversalOf(undone, '2026-10-30')]);
    expect(result).toMatchObject({ paid: 5_000_000, remaining: 3_000_000, hasPayment: true });
  });

  it('never has a negative entitlement', () => {
    expect(state([], { ...advance, installmentAmount: 9_000_000, outstanding: 9_000_000 }).entitlement).toBe(0);
  });
});

describe('planPayment', () => {
  it('accepts a full payment and applies the installment on the first payment', () => {
    expect(planPayment(state([], advance), 14_000_000, 7_000_000)).toEqual({ ok: true, installment: 1_000_000 });
  });

  it('applies no installment on a top-up', () => {
    const first = salaryPayment(3_000_000, PERIOD, '2026-10-25', 1_000_000);
    expect(planPayment(state([first], { ...advance, outstanding: 2_000_000 }), 14_000_000, 4_000_000)).toEqual({ ok: true, installment: 0 });
  });

  it('limits a payment to what the Pool holds (partial payment)', () => {
    const s = state();
    expect(maxPaymentNow(s, 3_500_000)).toBe(3_500_000);
    expect(planPayment(s, 3_500_000, 5_000_000)).toEqual({ ok: false, code: 'EXCEEDS_POOL', max: 3_500_000 });
    expect(planPayment(s, 3_500_000, 3_500_000)).toEqual({ ok: true, installment: 0 });
  });

  it('never allows more than the entitlement, whatever the Pool holds', () => {
    expect(planPayment(state(), 99_000_000, 8_000_001)).toEqual({ ok: false, code: 'EXCEEDS_ENTITLEMENT', max: 8_000_000 });
  });

  it('rejects zero, negative and fractional amounts', () => {
    for (const bad of [0, -1, 10.5]) {
      expect(planPayment(state(), 99_000_000, bad)).toMatchObject({ ok: false, code: 'INVALID_AMOUNT' });
    }
  });

  it('records a zero payment only to settle a fully withheld period', () => {
    const fullyWithheld = state([], { ...advance, installmentAmount: 8_000_000, outstanding: 8_000_000 });
    expect(planPayment(fullyWithheld, 0, 0)).toEqual({ ok: true, installment: 8_000_000 });
  });

  it('applies no installment when the Pool is empty and the payment is partial', () => {
    expect(planPayment(state(), 0, 1)).toEqual({ ok: false, code: 'EXCEEDS_POOL', max: 0 });
  });
});
