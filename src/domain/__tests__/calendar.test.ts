import {
  addDays, addMonths, currentPeriod, daysBetween, daysInMonth, isCompletedMonth, isDateString, isMonth,
  lastCompletedMonth, monthOf, monthRange, monthsBetween, nextPayday, paydayOf, periodStart,
} from '../calendar';

describe('months', () => {
  it('adds months across year boundaries in both directions', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-05', 0)).toBe('2026-05');
  });

  it('counts months between and builds inclusive ranges', () => {
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
    expect(monthsBetween('2026-02', '2025-11')).toBe(-3);
    expect(monthRange('2025-11', '2026-01')).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(monthRange('2026-03', '2026-01')).toEqual([]);
  });

  it('knows the length of a month, including leap years', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-10')).toBe(31);
  });

  it('treats a month as completed only once a later month has started', () => {
    expect(lastCompletedMonth('2026-01-05')).toBe('2025-12');
    expect(isCompletedMonth('2026-09', '2026-10-01')).toBe(true);
    expect(isCompletedMonth('2026-10', '2026-10-31')).toBe(false);
    expect(monthOf('2026-10-09')).toBe('2026-10');
  });
});

describe('dates', () => {
  it('validates real calendar dates and months', () => {
    expect(isDateString('2026-02-28')).toBe(true);
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('2026-2-3')).toBe(false);
    expect(isMonth('2026-12')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
  });

  it('adds days and measures distances across month ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(daysBetween('2026-10-09', '2026-10-25')).toBe(16);
    expect(daysBetween('2026-10-25', '2026-10-09')).toBe(-16);
    expect(daysBetween('2026-10-20', '2026-11-05')).toBe(16);
  });
});

describe('salary periods', () => {
  it('uses the payday month as the period id', () => {
    expect(paydayOf('2026-10', 25)).toBe('2026-10-25');
  });

  it('puts days before payday in the previous period', () => {
    expect(currentPeriod('2026-10-09', 25)).toBe('2026-09');
    expect(periodStart('2026-10-09', 25)).toBe('2026-09-25');
    expect(nextPayday('2026-10-09', 25)).toBe('2026-10-25');
  });

  it('starts a new period on payday itself and looks to the following month', () => {
    expect(currentPeriod('2026-10-25', 25)).toBe('2026-10');
    expect(nextPayday('2026-10-25', 25)).toBe('2026-11-25');
    expect(nextPayday('2026-12-28', 1)).toBe('2027-01-01');
  });
});
