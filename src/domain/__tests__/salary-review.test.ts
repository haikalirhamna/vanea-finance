import { RaiseInput, anchorFromMonthsSince, evaluateRaise, maxRaiseFor } from '../salary-review';
import { million, series } from './helpers/builders';

const LONG_AGO = '2000-01';

function input(amounts: number[], over: Partial<RaiseInput> = {}): RaiseInput {
  return { series: series('2025-01', amounts), currentSalary: 4_500_000, pool: 20_000_000, anchorPeriod: LONG_AGO, ...over };
}

// Nine steady months, then three clearly higher ones.
const RISING = [...Array(9).fill(5_300_000), ...million(6, 6.2, 6.4)];

describe('gate 1 — enough data', () => {
  it('needs six completed months', () => {
    const result = evaluateRaise(input(million(5, 5, 5, 5, 6)));
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.evidence.dataMonths).toBe(5);
  });
});

describe('gate 2 — cooldown', () => {
  it('waits until three full months have passed at the current salary', () => {
    const lastMonth = series('2025-01', RISING).at(-1)!.month;
    expect(evaluateRaise(input(RISING, { anchorPeriod: lastMonth })).status).toBe('COOLDOWN');
    expect(evaluateRaise(input(RISING, { anchorPeriod: anchorFromMonthsSince(lastMonth, 2) })).status).toBe('COOLDOWN');
    expect(evaluateRaise(input(RISING, { anchorPeriod: anchorFromMonthsSince(lastMonth, 3) })).status).toBe('ELIGIBLE');
  });
});

describe('gate 3 — a real, sustained shift', () => {
  it('rejects a one-off spike (PRD example)', () => {
    expect(evaluateRaise(input(million(5, 5.2, 5.1, 15, 5.3, 5.2))).status).toBe('OBSERVING');
  });

  it('rejects volatile income (PRD example)', () => {
    expect(evaluateRaise(input(million(4, 10, 3, 9, 4, 11))).status).toBe('OBSERVING');
  });

  it('rejects stable and declining income', () => {
    expect(evaluateRaise(input(million(5, 5, 5, 5, 5, 5))).status).toBe('OBSERVING');
    expect(evaluateRaise(input(million(8, 7.5, 7, 6.5, 6, 5.5))).status).toBe('OBSERVING');
  });

  it('requires every recent month to clear the bar, not just the median', () => {
    const oneWeak = [...Array(9).fill(5_300_000), ...million(6, 6.2, 5.4)];
    expect(evaluateRaise(input(oneWeak)).status).toBe('OBSERVING');
  });

  it('raises the bar for people whose income normally swings', () => {
    // Usual swing 20% -> the bar is 30% above the reference (6.5M), not 5% (5.25M).
    const swingy = [...million(3, 5, 4, 6, 3.5, 5.5, 4.5, 6.5, 5), ...million(6.2, 6.2, 6.2)];
    const result = evaluateRaise(input(swingy));
    expect(result.status).toBe('OBSERVING');
    expect(result.evidence.swing).toBeCloseTo(0.2, 10);
    expect(result.evidence.threshold).toBeCloseTo(0.3, 10);
    expect(result.evidence.requiredPerMonth).toBeCloseTo(6_500_000, 0);
  });

  it('accepts gradual growth (PRD example) once enough months show it', () => {
    const growth = [...Array(6).fill(5_000_000), ...million(5.3, 5.7, 6, 6.2, 6.4, 6.6)];
    expect(evaluateRaise(input(growth, { currentSalary: 4_000_000 })).status).toBe('ELIGIBLE');
  });
});

describe('gate 4 — not just a seasonal pattern', () => {
  const lastYear = million(9, 9, 9);
  const middle = Array(9).fill(5_000_000);

  it('rejects a rise that only matches the same months last year', () => {
    const result = evaluateRaise(input([...lastYear, ...middle, ...million(9.2, 9.2, 9.2)]));
    expect(result.status).toBe('SEASONAL_PATTERN');
    expect(result.evidence.sameMonthsLastYear).toHaveLength(3);
  });

  it('accepts a rise that also beats the same months last year', () => {
    const result = evaluateRaise(input([...lastYear, ...middle, ...million(10, 10, 10)]));
    expect(result.status).toBe('ELIGIBLE');
  });

  it('is skipped until a year of comparison data exists', () => {
    expect(evaluateRaise(input(RISING)).evidence.sameMonthsLastYear).toBeUndefined();
  });
});

describe('gate 5 — affordability', () => {
  it('waits when the Pool cannot support a full raise through the weakest months', () => {
    const result = evaluateRaise(input(RISING, { currentSalary: 5_200_000, pool: 0 }));
    expect(result.status).toBe('NOT_AFFORDABLE');
    expect(result.evidence.sustainableSalary).toBeLessThan(5_200_000 * 1.05);
  });
});

describe('eligible', () => {
  it('offers up to 5% rounded down to Rp 10.000, with the evidence behind it', () => {
    const result = evaluateRaise(input(RISING));
    expect(result.status).toBe('ELIGIBLE');
    expect(result.maxRaise).toBe(220_000);
    expect(result.maxNewSalary).toBe(4_720_000);
    expect(result.evidence.referenceIncome).toBe(5_300_000);
    expect(result.evidence.requiredPerMonth).toBeCloseTo(5_565_000, 0);
    expect(result.evidence.recent?.map((m) => m.amount)).toEqual(million(6, 6.2, 6.4));
  });

  it('never offers anything when not eligible', () => {
    const result = evaluateRaise(input(million(5, 5, 5, 5, 5, 5)));
    expect(result.maxNewSalary).toBeUndefined();
    expect(result.maxRaise).toBeUndefined();
  });
});

describe('maxRaiseFor', () => {
  it('matches the user-flow example', () => {
    expect(maxRaiseFor(5_000_000)).toBe(250_000);
    expect(maxRaiseFor(5_000_000) + 5_000_000).toBe(5_250_000);
  });

  it('rounds down to the nearest Rp 10.000', () => {
    expect(maxRaiseFor(4_555_000)).toBe(220_000);
    expect(maxRaiseFor(100_000)).toBe(0);
  });
});
