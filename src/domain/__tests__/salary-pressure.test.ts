import { assessPressure } from '../salary-pressure';
import { million } from './helpers/builders';

const income = million(6, 6, 6, 6, 6, 6);

function assess(over: { amounts?: number[]; salary?: number; pool?: number; commitment?: number } = {}) {
  const salary = over.salary ?? 5_000_000;
  return assessPressure({
    amounts: over.amounts ?? income, salary, pool: over.pool ?? 12_000_000, commitment: over.commitment ?? salary,
  });
}

describe('assessPressure', () => {
  it('is calm when income covers the salary', () => {
    expect(assess()).toMatchObject({ level: 'NONE', typicalIncome: 6_000_000, monthsToEmpty: null, safeSalary: null });
  });

  it('notes a thin buffer when the Pool covers less than a month', () => {
    expect(assess({ pool: 3_000_000 }).level).toBe('THIN_BUFFER');
  });

  it('does not judge with less than three months of data', () => {
    expect(assess({ amounts: million(2, 2) })).toMatchObject({ level: 'NONE', typicalIncome: null });
  });

  describe('salary above typical income', () => {
    const base = { amounts: million(5, 5, 4.6, 4.6, 4.6), salary: 5_000_000 }; // gap of 400.000 per month

    it.each([
      ['INFO', 4_000_000, 10],
      ['INFO', 2_800_000, 7],
      ['ATTENTION', 2_400_000, 6],
      ['ATTENTION', 1_400_000, 3.5],
      ['SERIOUS', 1_200_000, 3],
      ['SERIOUS', 0, 0],
    ])('is %s with a Pool of %i (about %f months left)', (level, pool, monthsToEmpty) => {
      const result = assess({ ...base, pool });
      expect(result.level).toBe(level);
      expect(result.monthsToEmpty).toBeCloseTo(monthsToEmpty, 6);
    });

    it('suggests a safe salary below the current one for ATTENTION and SERIOUS', () => {
      const attention = assess({ ...base, pool: 2_000_000 });
      expect(attention.safeSalary).not.toBeNull();
      expect(attention.safeSalary!).toBeLessThan(5_000_000);
      // Empty Pool: only the 95%-of-average cap remains (mean 4.76M -> 4.52M -> 4.5M).
      expect(assess({ ...base, pool: 0 }).safeSalary).toBe(4_500_000);
    });

    it('shows no safe salary for the quiet INFO level', () => {
      expect(assess({ ...base, pool: 4_000_000 }).safeSalary).toBeNull();
    });
  });

  it('reports the runway from the full monthly commitment', () => {
    expect(assess({ pool: 17_000_000, commitment: 8_500_000 }).runwayMonths).toBeCloseTo(2, 10);
    expect(assess({ commitment: 0 }).runwayMonths).toBeNull();
  });
});
