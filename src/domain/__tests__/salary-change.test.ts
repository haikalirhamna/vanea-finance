import {
  SalaryChangeRequest, SalarySetting, anchorPeriod, calibrationEnd, firstUnpaidPeriod, restoreCeiling,
  restoreOffer, salaryFor, validateSalaryChange,
} from '../salary-change';
import { reversalOf, salaryPayment } from './helpers/builders';

const history: SalarySetting[] = [
  { amount: 5_000_000, effectivePeriod: '2026-01', changeType: 'initial' },
  { amount: 4_000_000, effectivePeriod: '2026-05', changeType: 'decrease' },
];

describe('reading the salary history', () => {
  it('finds the salary in effect for a period', () => {
    expect(salaryFor(history, '2025-12')).toBeNull();
    expect(salaryFor(history, '2026-04')).toBe(5_000_000);
    expect(salaryFor(history, '2026-05')).toBe(4_000_000);
    expect(salaryFor(history, '2027-01')).toBe(4_000_000);
  });

  it('prefers the later setting when two share a period', () => {
    const settings: SalarySetting[] = [
      { amount: 5_000_000, effectivePeriod: '2026-01', changeType: 'initial' },
      { amount: 4_800_000, effectivePeriod: '2026-01', changeType: 'calibration' },
    ];
    expect(salaryFor(settings, '2026-01')).toBe(4_800_000);
  });

  it('uses the latest setting even when the history is not sorted', () => {
    const unsorted: SalarySetting[] = [history[1]!, history[0]!];
    expect(salaryFor(unsorted, '2026-06')).toBe(4_000_000);
  });

  it('anchors the cooldown on initial, calibration and increase — not on decreases', () => {
    expect(anchorPeriod(history)).toBe('2026-01');
    expect(anchorPeriod([])).toBeNull();
    const withIncrease: SalarySetting[] = [...history, { amount: 4_200_000, effectivePeriod: '2026-08', changeType: 'increase' }];
    expect(anchorPeriod(withIncrease)).toBe('2026-08');
  });

  it('ends calibration after three salary periods', () => {
    expect(calibrationEnd('2026-10')).toBe('2026-12');
  });
});

describe('restore ceiling', () => {
  it('lets the user return to the highest salary of the last 12 months', () => {
    expect(restoreCeiling(history, '2026-06')).toBe(5_000_000);
    expect(restoreOffer(history, '2026-06')).toBe(5_000_000);
  });

  it('forgets salaries older than 12 months', () => {
    expect(restoreCeiling(history, '2027-02')).toBe(5_000_000);
    expect(restoreCeiling(history, '2027-03')).toBe(5_000_000);
    expect(restoreCeiling(history, '2027-04')).toBe(4_000_000);
    expect(restoreOffer(history, '2027-04')).toBeNull();
  });

  it('offers nothing before any salary or when already at the ceiling', () => {
    expect(restoreCeiling([], '2026-06')).toBeNull();
    expect(restoreOffer([history[0]!], '2026-06')).toBeNull();
  });
});

describe('first unpaid period', () => {
  it('is the current period until something is paid, then the next', () => {
    expect(firstUnpaidPeriod([], '2026-10-09', 25)).toBe('2026-09');
    const paid = salaryPayment(5_000_000, '2026-09', '2026-09-25');
    expect(firstUnpaidPeriod([paid], '2026-10-09', 25)).toBe('2026-10');
  });

  it('ignores a payment that was reversed', () => {
    const paid = salaryPayment(5_000_000, '2026-09', '2026-09-25');
    expect(firstUnpaidPeriod([paid, reversalOf(paid, '2026-09-26')], '2026-10-09', 25)).toBe('2026-09');
  });
});

describe('validateSalaryChange', () => {
  const base: SalaryChangeRequest = {
    changeType: 'decrease', newAmount: 4_000_000, currentSalary: 5_000_000, period: '2026-06',
    calibrationUntil: '2026-03', restoreCeiling: 5_000_000,
  };
  const eligible = { status: 'ELIGIBLE' as const, maxNewSalary: 5_250_000, decision: 'none' as const };

  it('rejects non-positive and fractional amounts for every type', () => {
    expect(validateSalaryChange({ ...base, newAmount: 0 })).toEqual({ ok: false, code: 'INVALID_AMOUNT' });
    expect(validateSalaryChange({ ...base, newAmount: 1.5 })).toEqual({ ok: false, code: 'INVALID_AMOUNT' });
  });

  it('sets an initial salary only once', () => {
    expect(validateSalaryChange({ ...base, changeType: 'initial', currentSalary: null })).toEqual({ ok: true });
    expect(validateSalaryChange({ ...base, changeType: 'initial' })).toMatchObject({ code: 'ALREADY_HAS_SALARY' });
  });

  it('allows calibration only inside the calibration window', () => {
    expect(validateSalaryChange({ ...base, changeType: 'calibration', period: '2026-03' })).toEqual({ ok: true });
    expect(validateSalaryChange({ ...base, changeType: 'calibration' })).toMatchObject({ code: 'CALIBRATION_ENDED' });
  });

  it('allows a decrease anytime, but only downward', () => {
    expect(validateSalaryChange(base)).toEqual({ ok: true });
    expect(validateSalaryChange({ ...base, newAmount: 5_000_000 })).toMatchObject({ code: 'NOT_A_DECREASE' });
    expect(validateSalaryChange({ ...base, currentSalary: null })).toMatchObject({ code: 'NOT_A_DECREASE' });
  });

  describe('increase', () => {
    const increase = { ...base, changeType: 'increase' as const, review: eligible };

    it('is allowed up to the maximum from an eligible, undecided review', () => {
      expect(validateSalaryChange({ ...increase, newAmount: 5_250_000 })).toEqual({ ok: true });
      expect(validateSalaryChange({ ...increase, newAmount: 5_100_000 })).toEqual({ ok: true });
    });

    it('cannot exceed the maximum', () => {
      expect(validateSalaryChange({ ...increase, newAmount: 5_260_000 })).toEqual({
        ok: false, code: 'ABOVE_MAX_RAISE', max: 5_250_000,
      });
    });

    it('needs an eligible, undecided review', () => {
      expect(validateSalaryChange({ ...increase, newAmount: 5_100_000, review: undefined })).toMatchObject({ code: 'NOT_ELIGIBLE' });
      for (const status of ['INSUFFICIENT_DATA', 'COOLDOWN', 'OBSERVING', 'SEASONAL_PATTERN', 'NOT_AFFORDABLE'] as const) {
        expect(validateSalaryChange({ ...increase, newAmount: 5_100_000, review: { status, decision: 'none' } }))
          .toMatchObject({ code: 'NOT_ELIGIBLE' });
      }
      expect(validateSalaryChange({ ...increase, newAmount: 5_100_000, review: { ...eligible, decision: 'declined' } }))
        .toMatchObject({ code: 'NOT_ELIGIBLE' });
    });

    it('must actually be an increase', () => {
      expect(validateSalaryChange({ ...increase, newAmount: 5_000_000 })).toMatchObject({ code: 'NOT_AN_INCREASE' });
    });
  });

  describe('restore', () => {
    const restore = { ...base, changeType: 'restore' as const, currentSalary: 4_000_000 };

    it('is allowed up to the ceiling without any review', () => {
      expect(validateSalaryChange({ ...restore, newAmount: 5_000_000 })).toEqual({ ok: true });
      expect(validateSalaryChange({ ...restore, newAmount: 4_500_000 })).toEqual({ ok: true });
    });

    it('cannot go past the ceiling', () => {
      expect(validateSalaryChange({ ...restore, newAmount: 5_000_001 })).toEqual({
        ok: false, code: 'ABOVE_RESTORE_CEILING', max: 5_000_000,
      });
      expect(validateSalaryChange({ ...restore, newAmount: 4_500_000, restoreCeiling: null })).toMatchObject({
        code: 'ABOVE_RESTORE_CEILING',
      });
    });

    it('must actually be an increase', () => {
      expect(validateSalaryChange({ ...restore, newAmount: 3_500_000 })).toMatchObject({ code: 'NOT_AN_INCREASE' });
    });
  });
});
